import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, FileText, Calendar, Tag, Shield } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { LegalDocument } from '@/types';

interface LegalDocumentViewerProps {
  document: LegalDocument | null;
  isLoading?: boolean;
}

export default function LegalDocumentViewer({ document, isLoading }: LegalDocumentViewerProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Loading...',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading document...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!document) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Document Not Found',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.errorContainer}>
          <View style={styles.errorIconContainer}>
            <FileText size={64} color={colors.text.tertiary} />
          </View>
          <Text style={styles.errorTitle}>Document Not Found</Text>
          <Text style={styles.errorText}>
            The document you're looking for doesn't exist or has been removed.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // HTML renderer that properly displays HTML content
  const renderContent = () => {
    const content = document.content;
    const elements: React.ReactElement[] = [];
    let keyIndex = 0;

    // Function to decode HTML entities
    const decodeHtmlEntities = (text: string) => {
      return text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&hellip;/g, '…');
    };

    // Simple HTML parser that handles common tags
    const parseHTML = (html: string) => {
      const result: Array<{ type: string; content: string; tag?: string; level?: number }> = [];
      
      // Match HTML tags and text
      const regex = /(<\/?[a-zA-Z][^>]*>)|([^<]+)/g;
      let match;
      let stack: Array<{ tag: string; level: number }> = [];

      while ((match = regex.exec(html)) !== null) {
        if (match[1]) {
          // It's a tag
          const tagMatch = match[1].match(/<\/?([a-zA-Z][a-zA-Z0-9]*)/);
          if (tagMatch) {
            const tagName = tagMatch[1].toLowerCase();
            const isClosing = match[1].startsWith('</');
            
            if (isClosing) {
              // Pop from stack
              if (stack.length > 0 && stack[stack.length - 1].tag === tagName) {
                stack.pop();
              }
            } else {
              // Push to stack
              const level = stack.length;
              stack.push({ tag: tagName, level });
              
              if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'ul', 'ol'].includes(tagName)) {
                result.push({
                  type: 'tag',
                  tag: tagName,
                  content: match[1],
                  level,
                });
              }
            }
          }
        } else if (match[2]) {
          // It's text content
          const text = match[2].trim();
          if (text) {
            result.push({
              type: 'text',
              content: text,
            });
          }
        }
      }

      return result;
    };

    const parsed = parseHTML(content);
    let currentParagraph: string[] = [];
    let currentHeading: string | null = null;
    let inHeading = false;
    let headingLevel = 1;
    let listItems: string[] = [];
    let inList = false;

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const paraText = currentParagraph.join(' ').trim();
        if (paraText) {
          elements.push(
            <Text key={keyIndex++} style={styles.paragraph}>
              {decodeHtmlEntities(paraText)}
            </Text>
          );
        }
        currentParagraph = [];
      }
    };

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <View key={keyIndex++} style={styles.listContainer}>
            {listItems.map((item, idx) => (
              <View key={idx} style={styles.listItem}>
                <Text style={styles.listBullet}>•</Text>
                <Text style={styles.listItemText}>{decodeHtmlEntities(item)}</Text>
              </View>
            ))}
          </View>
        );
        listItems = [];
      }
      inList = false;
    };

    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i];

      if (item.type === 'tag') {
        const tagName = item.tag!;
        const isClosing = item.content.startsWith('</');

        if (isClosing) {
          switch (tagName) {
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
              if (currentHeading) {
                const level = parseInt(tagName.charAt(1)) || 1;
                elements.push(
                  <Text
                    key={keyIndex++}
                    style={[
                      styles.heading,
                      level === 1 && styles.heading1,
                      level === 2 && styles.heading2,
                      level === 3 && styles.heading3,
                    ]}
                  >
                    {decodeHtmlEntities(currentHeading)}
                  </Text>
                );
                currentHeading = null;
              }
              inHeading = false;
              break;
            case 'p':
              flushParagraph();
              break;
            case 'ul':
            case 'ol':
              flushList();
              break;
            case 'li':
              // List item text is collected before </li>
              break;
          }
        } else {
          // Opening tag
          switch (tagName) {
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
              flushParagraph();
              flushList();
              inHeading = true;
              headingLevel = parseInt(tagName.charAt(1)) || 1;
              currentHeading = '';
              break;
            case 'p':
              flushParagraph();
              flushList();
              break;
            case 'ul':
            case 'ol':
              flushParagraph();
              flushList();
              inList = true;
              break;
            case 'li':
              // Start collecting list item text
              break;
            case 'br':
              currentParagraph.push('\n');
              break;
          }
        }
      } else if (item.type === 'text') {
        let text = item.content;
        
        // Handle inline formatting (bold, italic, etc.)
        // For now, we'll strip the tags but keep the text
        text = text.replace(/<[^>]*>/g, '');

        if (inHeading && currentHeading !== null) {
          currentHeading += text;
        } else if (inList) {
          // Check if next item is </li> to know when to add to list
          const nextItem = parsed[i + 1];
          if (nextItem && nextItem.type === 'tag' && nextItem.tag === 'li' && nextItem.content.startsWith('</')) {
            listItems.push(text);
          } else {
            // Continue collecting list item text
            if (listItems.length > 0) {
              listItems[listItems.length - 1] += ' ' + text;
            } else {
              listItems.push(text);
            }
          }
        } else {
          currentParagraph.push(text);
        }
      }
    }

    // Flush any remaining content
    flushParagraph();
    flushList();

    // If no elements were created, render as plain text
    if (elements.length === 0) {
      const paragraphs = content.split('\n').filter(p => p.trim().length > 0);
      return paragraphs.map((para, index) => (
        <Text key={index} style={styles.paragraph}>
          {decodeHtmlEntities(para.replace(/<[^>]*>/g, '').trim())}
        </Text>
      ));
    }

    return elements;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: document.title,
          headerStyle: {
            backgroundColor: colors.background.primary,
          },
          headerTintColor: colors.text.primary,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header */}
        <View style={styles.heroHeader}>
          <View style={styles.iconContainer}>
            <Shield size={32} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>{document.title}</Text>
          <View style={styles.badgeContainer}>
            <View style={styles.badge}>
              <Tag size={14} color={colors.primary} />
              <Text style={styles.badgeText}>v{document.version}</Text>
            </View>
            {document.isRequired && (
              <View style={[styles.badge, styles.requiredBadge]}>
                <Text style={styles.requiredBadgeText}>Required</Text>
              </View>
            )}
          </View>
        </View>

        {/* Meta Information Card */}
        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Calendar size={16} color={colors.text.secondary} />
              <View style={styles.metaTextContainer}>
                <Text style={styles.metaLabel}>Last Updated</Text>
                <Text style={styles.metaValue}>{formatDate(document.updatedAt)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Content Card */}
        <View style={styles.contentCard}>
          <View style={styles.contentHeader}>
            <View style={styles.contentHeaderLine} />
            <Text style={styles.contentTitle}>Document Content</Text>
            <View style={styles.contentHeaderLine} />
          </View>
          <View style={styles.contentBody}>
            {renderContent()}
          </View>
        </View>

        {/* Footer Note */}
        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            By using this service, you acknowledge that you have read, understood, and agree to be bound by this document.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroHeader: {
    backgroundColor: colors.background.primary,
    paddingTop: 80,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 20,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 36,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  requiredBadge: {
    backgroundColor: colors.danger + '15',
    borderColor: colors.danger + '30',
  },
  requiredBadgeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.danger,
  },
  metaCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  metaRow: {
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaTextContainer: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: colors.text.tertiary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  contentCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  contentHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.light,
  },
  contentTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: colors.text.secondary,
    paddingHorizontal: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  contentBody: {
    padding: 24,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 28,
    color: colors.text.primary,
    marginBottom: 20,
    letterSpacing: 0.2,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginTop: 24,
    marginBottom: 12,
    lineHeight: 28,
  },
  heading1: {
    fontSize: 28,
    fontWeight: '700' as const,
    marginTop: 32,
    marginBottom: 16,
  },
  heading2: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginTop: 28,
    marginBottom: 14,
  },
  heading3: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginTop: 24,
    marginBottom: 12,
  },
  listContainer: {
    marginVertical: 12,
    paddingLeft: 8,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 4,
  },
  listBullet: {
    fontSize: 16,
    color: colors.primary,
    marginRight: 12,
    fontWeight: '700' as const,
  },
  listItemText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text.primary,
  },
  footerNote: {
    backgroundColor: colors.primary + '10',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  footerText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
