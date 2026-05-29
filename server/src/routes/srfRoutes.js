import { Router } from "express";
import multer from "multer";
import {
  approveSrf,
  bulkDownloadZip,
  bulkSummaryExcel,
  createSrf,
  deleteDraft,
  downloadPdf,
  downloadExcel,
  downloadMasterExcel,
  emailSrfForApproval,
  getSrf,
  listAllSrf,
  listDrafts,
  listMySrf,
  openBulkOutlookDraft,
  openOutlookDraft,
  parseOfferLetterUpload,
  rejectSrf,
  resendSrf,
  saveDraft
} from "../controllers/srfController.js";
import { requireAuth, requireAdmin, requireSuperAdmin } from "../middleware/auth.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

router.use(requireAuth);

router.post("/", createSrf);
router.post("/parse-offer-letter", upload.single("file"), parseOfferLetterUpload);

router.get("/mine", listMySrf);
router.get("/drafts", listDrafts);
router.post("/drafts", saveDraft);
router.delete("/drafts/:id", deleteDraft);

router.get("/all", requireAdmin, listAllSrf);
router.get("/master-excel", requireAdmin, downloadMasterExcel);

router.post("/bulk-email-outlook", requireSuperAdmin, openBulkOutlookDraft);
router.post("/bulk-download", requireSuperAdmin, bulkDownloadZip);
router.post("/bulk-summary-excel", requireSuperAdmin, bulkSummaryExcel);

router.get("/:id", getSrf);
router.get("/:id/pdf", downloadPdf);
router.get("/:id/excel", downloadExcel);

router.post("/:id/approve", requireAdmin, approveSrf);
router.post("/:id/reject", requireAdmin, rejectSrf);
router.post("/:id/resend", resendSrf);

router.post("/:id/email", requireSuperAdmin, emailSrfForApproval);
router.post("/:id/email-outlook", requireSuperAdmin, openOutlookDraft);

export default router;
