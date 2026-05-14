import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

type AcceptLegalBody = {
  documents?: Array<{
    documentId?: string;
    documentVersion?: string;
  }>;
};

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!accessToken) {
      return NextResponse.json({ success: false, error: 'Missing auth session.' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user?.id) {
      return NextResponse.json({ success: false, error: 'Invalid or expired auth session.' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as AcceptLegalBody;
    const requestedDocs = Array.isArray(body.documents) ? body.documents : [];
    const requestedIds = Array.from(
      new Set(
        requestedDocs
          .map((doc) => (typeof doc.documentId === 'string' ? doc.documentId.trim() : ''))
          .filter(Boolean)
      )
    );

    if (requestedIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No legal documents selected.' }, { status: 400 });
    }

    const { data: legalDocs, error: docsError } = await supabase
      .from('legal_documents')
      .select('id,version,is_active,is_required')
      .in('id', requestedIds)
      .eq('is_active', true)
      .eq('is_required', true);

    if (docsError) throw docsError;
    if (!legalDocs || legalDocs.length !== requestedIds.length) {
      return NextResponse.json(
        { success: false, error: 'One or more legal documents are no longer available.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const rows = legalDocs.map((doc) => ({
      user_id: user.id,
      document_id: doc.id,
      document_version: doc.version || '1.0.0',
      context: 'web_gate',
      accepted_at: now,
    }));

    const { error: upsertError } = await supabase
      .from('user_legal_acceptances')
      .upsert(rows, { onConflict: 'user_id,document_id' });

    if (upsertError) throw upsertError;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('legal acceptances error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to save legal acceptance.' },
      { status: 500 }
    );
  }
}
