import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import { endRelationshipProcedure } from "./routes/relationships/end";
import { confirmEndRelationshipProcedure } from "./routes/relationships/confirm-end";
import { createCertificateProcedure } from "./routes/certificates/create";
import { createAnniversaryProcedure } from "./routes/anniversaries/create";
import { createMilestoneProcedure } from "./routes/milestones/create";
import { listMilestonesProcedure } from "./routes/milestones/list";
import { getCoupleLevelProcedure } from "./routes/achievements/get-couple-level";
import { getAnalyticsProcedure } from "./routes/admin/analytics";
import { getActivityLogsProcedure } from "./routes/admin/activity-logs";
import {
  getAllRelationshipsProcedure,
  updateRelationshipProcedure,
  deleteRelationshipProcedure,
} from "./routes/admin/manage-relationships";
import {
  getReportedContentProcedure,
  reviewReportProcedure,
} from "./routes/admin/manage-reports";
import {
  detectDuplicateRelationshipsProcedure,
  checkCheatingPatternProcedure,
} from "./routes/fraud/detect-duplicates";
import { getDiscoveryProcedure } from "./routes/dating/get-discovery";
import { getDatingProfileProcedure } from "./routes/dating/get-profile";
import { createOrUpdateDatingProfileProcedure } from "./routes/dating/create-or-update-profile";
import { likeUserProcedure } from "./routes/dating/like-user";
import { passUserProcedure } from "./routes/dating/pass-user";
import { getMatchesProcedure } from "./routes/dating/get-matches";
import { unmatchProcedure } from "./routes/dating/unmatch";
import { uploadDatingPhotoProcedure } from "./routes/dating/upload-photo";
import { deleteDatingPhotoProcedure } from "./routes/dating/delete-photo";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  relationships: createTRPCRouter({
    end: endRelationshipProcedure,
    confirmEnd: confirmEndRelationshipProcedure,
  }),
  certificates: createTRPCRouter({
    create: createCertificateProcedure,
  }),
  anniversaries: createTRPCRouter({
    create: createAnniversaryProcedure,
  }),
  milestones: createTRPCRouter({
    create: createMilestoneProcedure,
    list: listMilestonesProcedure,
  }),
  achievements: createTRPCRouter({
    getCoupleLevel: getCoupleLevelProcedure,
  }),
  admin: createTRPCRouter({
    analytics: getAnalyticsProcedure,
    activityLogs: getActivityLogsProcedure,
    getAllRelationships: getAllRelationshipsProcedure,
    updateRelationship: updateRelationshipProcedure,
    deleteRelationship: deleteRelationshipProcedure,
    getReportedContent: getReportedContentProcedure,
    reviewReport: reviewReportProcedure,
  }),
  fraud: createTRPCRouter({
    detectDuplicates: detectDuplicateRelationshipsProcedure,
    checkCheatingPattern: checkCheatingPatternProcedure,
  }),
  dating: createTRPCRouter({
    getDiscovery: getDiscoveryProcedure,
    getProfile: getDatingProfileProcedure,
    createOrUpdateProfile: createOrUpdateDatingProfileProcedure,
    likeUser: likeUserProcedure,
    passUser: passUserProcedure,
    getMatches: getMatchesProcedure,
    unmatch: unmatchProcedure,
    uploadPhoto: uploadDatingPhotoProcedure,
    deletePhoto: deleteDatingPhotoProcedure,
  }),
});

export type AppRouter = typeof appRouter;
