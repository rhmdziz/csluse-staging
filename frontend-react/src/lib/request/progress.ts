import type { ProgressStepItem } from "@/components/shared";
import { formatDateTimeWib } from "@/lib/date";
import {
  getMentorApprovalStageLabel,
  hasMentorApprovalTrace,
} from "@/lib/request";

type BasicProgressInput = {
  status: string;
  purpose?: string;
  requesterMentorProfileId?: string;
  isApprovedByMentor?: boolean;
  mentorApprovedAt?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  expiredAt?: string;
  completedAt?: string;
};

type BorrowProgressInput = BasicProgressInput & {
  endTimeActual: string;
  borrowedAt?: string;
  returnedPendingInspectionAt?: string;
  inspectedAt?: string;
  returnedAt?: string;
  overdueAt?: string;
  lostDamagedAt?: string;
};

function normalizeStatus(value: string) {
  return value.toLowerCase();
}

function pickTime(...values: Array<string | undefined>) {
  const found = values.find((value) => value && value !== "-");
  return found ? formatDateTimeWib(found) : undefined;
}

function withMentorStep(
  item: BasicProgressInput,
  steps: ProgressStepItem[],
): ProgressStepItem[] {
  if (!hasMentorApprovalTrace(item)) {
    return steps;
  }

  const mentorLabel = getMentorApprovalStageLabel(item);
  const mentorStep: ProgressStepItem = {
    key: "mentor-approval",
    label: mentorLabel || "Tahap Dosen Pembimbing",
    state: item.isApprovedByMentor
      ? "finish"
      : normalizeStatus(item.status) === "rejected"
        ? "error"
        : "process",
    time: item.isApprovedByMentor
      ? pickTime(item.mentorApprovedAt, item.updatedAt)
      : undefined,
  };

  const nextSteps = [...steps];
  nextSteps.splice(1, 0, mentorStep);
  return nextSteps;
}

export function getBookingProgressFlow(
  booking: BasicProgressInput,
): ProgressStepItem[] {
  const status = normalizeStatus(booking.status);
  const baseSteps = withMentorStep(booking, [
    {
      key: "submitted",
      label: "Diajukan",
      time: formatDateTimeWib(booking.createdAt),
      state: "finish",
    },
    {
      key: "approved",
      label: "Disetujui",
      state: "wait",
    },
    {
      key: "completed",
      label: "Selesai",
      state: "wait",
    },
  ]);

  if (status === "pending") return baseSteps;
  if (status === "approved") {
    const approvedIndex = hasMentorApprovalTrace(booking) ? 2 : 1;
    const completedIndex = hasMentorApprovalTrace(booking) ? 3 : 2;
    baseSteps[approvedIndex].state = "finish";
    baseSteps[approvedIndex].time = pickTime(booking.approvedAt, booking.updatedAt);
    baseSteps[completedIndex].state = "process";
    return baseSteps;
  }
  if (status === "canceled" || status === "cancelled") {
    const canceledIndex = hasMentorApprovalTrace(booking) ? 2 : 1;
    baseSteps[canceledIndex] = {
      key: "canceled",
      label: "Dibatalkan",
      time: pickTime(booking.updatedAt),
      state: "error",
    };
    return baseSteps.slice(0, canceledIndex + 1);
  }
  if (status === "completed") {
    const approvedIndex = hasMentorApprovalTrace(booking) ? 2 : 1;
    const completedIndex = hasMentorApprovalTrace(booking) ? 3 : 2;
    baseSteps[approvedIndex].state = "finish";
    baseSteps[approvedIndex].time = pickTime(booking.approvedAt, booking.updatedAt);
    baseSteps[completedIndex].state = "finish";
    baseSteps[completedIndex].time = pickTime(booking.completedAt, booking.updatedAt);
    return baseSteps;
  }
  if (status === "rejected") {
    const rejectedIndex = hasMentorApprovalTrace(booking) && booking.isApprovedByMentor ? 2 : 1;
    baseSteps[rejectedIndex] = {
      key: "rejected",
      label: "Ditolak",
      time: pickTime(booking.rejectedAt, booking.updatedAt),
      state: "error",
    };
    return baseSteps.slice(0, rejectedIndex + 1);
  }
  if (status === "expired") {
    const expiredIndex = hasMentorApprovalTrace(booking) ? 2 : 1;
    baseSteps[expiredIndex] = {
      key: "expired",
      label: "Kedaluwarsa",
      time: pickTime(booking.expiredAt, booking.updatedAt),
      state: "error",
    };
    return baseSteps.slice(0, expiredIndex + 1);
  }
  return baseSteps;
}


export function getSampleTestingProgressFlow(
  item: BasicProgressInput,
): ProgressStepItem[] {
  const status = normalizeStatus(item.status);
  const steps: ProgressStepItem[] = [
    {
      key: "submitted",
      label: "Diajukan",
      time: formatDateTimeWib(item.createdAt),
      state: "finish",
    },
    {
      key: "approved",
      label: "Disetujui",
      state: "wait",
    },
    {
      key: "processed",
      label: "Diproses",
      state: "wait",
    },
    {
      key: "completed",
      label: "Selesai",
      state: "wait",
    },
  ];

  if (status === "pending") return steps;
  if (status === "approved") {
    steps[1].state = "finish";
    steps[1].time = pickTime(item.approvedAt, item.updatedAt);
    steps[2].state = "process";
    return steps;
  }
  if (status === "canceled" || status === "cancelled") {
    steps[1] = {
      key: "canceled",
      label: "Dibatalkan",
      time: pickTime(item.updatedAt),
      state: "error",
    };
    return steps.slice(0, 2);
  }
  if (status === "diproses") {
    steps[1].state = "finish";
    steps[1].time = pickTime(item.approvedAt, item.updatedAt);
    steps[2].state = "finish";
    steps[2].time = pickTime(item.updatedAt);
    return steps;
  }
  if (status === "completed") {
    steps[1].state = "finish";
    steps[1].time = pickTime(item.approvedAt, item.updatedAt);
    steps[2].state = "finish";
    steps[2].time = pickTime(item.updatedAt);
    steps[3].state = "finish";
    steps[3].time = pickTime(item.completedAt, item.updatedAt);
    return steps;
  }
  if (status === "rejected") {
    steps[1] = {
      key: "rejected",
      label: "Ditolak",
      time: pickTime(item.rejectedAt, item.updatedAt),
      state: "error",
    };
    return steps.slice(0, 2);
  }

  return steps;
}

export function getBorrowProgressFlow(
  item: BorrowProgressInput,
): ProgressStepItem[] {
  const status = normalizeStatus(item.status);
  const baseSteps = withMentorStep(item, [
    {
      key: "submitted",
      label: "Diajukan",
      time: formatDateTimeWib(item.createdAt),
      state: "finish",
    },
    {
      key: "approved",
      label: "Disetujui",
      state: "wait",
    },
    {
      key: "borrowed",
      label: "Dipinjam",
      state: "wait",
    },
    {
      key: "returned",
      label: "Diterima Kembali",
      state: "wait",
    },
    {
      key: "inspection",
      label: "Inspeksi",
      state: "wait",
    },
    {
      key: "completed",
      label: "Selesai",
      state: "wait",
    },
  ]);

  if (status === "pending") return baseSteps;
  if (status === "approved") {
    const approvedIndex = hasMentorApprovalTrace(item) ? 2 : 1;
    const borrowedIndex = hasMentorApprovalTrace(item) ? 3 : 2;
    baseSteps[approvedIndex].state = "finish";
    baseSteps[approvedIndex].time = pickTime(item.approvedAt, item.updatedAt);
    baseSteps[borrowedIndex].state = "process";
    return baseSteps;
  }
  if (status === "canceled" || status === "cancelled") {
    const canceledIndex = hasMentorApprovalTrace(item) ? 2 : 1;
    baseSteps[canceledIndex] = {
      key: "canceled",
      label: "Dibatalkan",
      time: pickTime(item.updatedAt),
      state: "error",
    };
    return baseSteps.slice(0, canceledIndex + 1);
  }
  if (status === "borrowed") {
    const approvedIndex = hasMentorApprovalTrace(item) ? 2 : 1;
    const borrowedIndex = hasMentorApprovalTrace(item) ? 3 : 2;
    const returnedIndex = hasMentorApprovalTrace(item) ? 4 : 3;
    baseSteps[approvedIndex].state = "finish";
    baseSteps[approvedIndex].time = pickTime(item.approvedAt, item.updatedAt);
    baseSteps[borrowedIndex].state = "finish";
    baseSteps[borrowedIndex].time = pickTime(item.borrowedAt, item.updatedAt);
    baseSteps[returnedIndex].state = "process";
    return baseSteps;
  }
  if (
    status === "returned pending inspection" ||
    status === "returned_pending_inspection"
  ) {
    const approvedIndex = hasMentorApprovalTrace(item) ? 2 : 1;
    const borrowedIndex = hasMentorApprovalTrace(item) ? 3 : 2;
    const returnedIndex = hasMentorApprovalTrace(item) ? 4 : 3;
    const inspectionIndex = hasMentorApprovalTrace(item) ? 5 : 4;
    baseSteps[approvedIndex].state = "finish";
    baseSteps[approvedIndex].time = pickTime(item.approvedAt, item.updatedAt);
    baseSteps[borrowedIndex].state = "finish";
    baseSteps[borrowedIndex].time = pickTime(item.borrowedAt, item.updatedAt);
    baseSteps[returnedIndex].state = "finish";
    baseSteps[returnedIndex].time = pickTime(
      item.returnedPendingInspectionAt,
      item.endTimeActual,
      item.updatedAt,
    );
    baseSteps[inspectionIndex].state = "process";
    return baseSteps;
  }
  if (status === "returned") {
    const approvedIndex = hasMentorApprovalTrace(item) ? 2 : 1;
    const borrowedIndex = hasMentorApprovalTrace(item) ? 3 : 2;
    const returnedIndex = hasMentorApprovalTrace(item) ? 4 : 3;
    const inspectionIndex = hasMentorApprovalTrace(item) ? 5 : 4;
    const completedIndex = hasMentorApprovalTrace(item) ? 6 : 5;
    baseSteps[approvedIndex].state = "finish";
    baseSteps[approvedIndex].time = pickTime(item.approvedAt, item.updatedAt);
    baseSteps[borrowedIndex].state = "finish";
    baseSteps[borrowedIndex].time = pickTime(item.borrowedAt, item.updatedAt);
    baseSteps[returnedIndex].state = "finish";
    baseSteps[returnedIndex].time = pickTime(
      item.returnedPendingInspectionAt,
      item.endTimeActual,
      item.updatedAt,
    );
    baseSteps[inspectionIndex].state = "finish";
    baseSteps[inspectionIndex].time = pickTime(item.inspectedAt, item.updatedAt);
    baseSteps[completedIndex].state = "finish";
    baseSteps[completedIndex].time = pickTime(item.returnedAt, item.inspectedAt, item.updatedAt);
    return baseSteps;
  }
  if (status === "rejected") {
    const rejectedIndex = hasMentorApprovalTrace(item) && item.isApprovedByMentor ? 2 : 1;
    baseSteps[rejectedIndex] = {
      key: "rejected",
      label: "Ditolak",
      time: pickTime(item.rejectedAt, item.updatedAt),
      state: "error",
    };
    return baseSteps.slice(0, rejectedIndex + 1);
  }
  if (status === "expired") {
    const expiredIndex = hasMentorApprovalTrace(item) ? 2 : 1;
    baseSteps[expiredIndex] = {
      key: "expired",
      label: "Expired",
      time: pickTime(item.expiredAt, item.updatedAt),
      state: "error",
    };
    return baseSteps.slice(0, expiredIndex + 1);
  }
  if (status === "overdue") {
    const approvedIndex = hasMentorApprovalTrace(item) ? 2 : 1;
    const borrowedIndex = hasMentorApprovalTrace(item) ? 3 : 2;
    const overdueIndex = hasMentorApprovalTrace(item) ? 4 : 3;
    baseSteps[approvedIndex].state = "finish";
    baseSteps[approvedIndex].time = pickTime(item.approvedAt, item.updatedAt);
    baseSteps[borrowedIndex].state = "finish";
    baseSteps[borrowedIndex].time = pickTime(item.borrowedAt, item.updatedAt);
    baseSteps[overdueIndex] = {
      key: "overdue",
      label: "Terlambat",
      time: pickTime(item.overdueAt, item.updatedAt),
      state: "error",
    };
    return baseSteps.slice(0, overdueIndex + 1);
  }
  if (status === "lost/damaged") {
    const approvedIndex = hasMentorApprovalTrace(item) ? 2 : 1;
    const borrowedIndex = hasMentorApprovalTrace(item) ? 3 : 2;
    const returnedIndex = hasMentorApprovalTrace(item) ? 4 : 3;
    const lostDamagedIndex = hasMentorApprovalTrace(item) ? 5 : 4;
    baseSteps[approvedIndex].state = "finish";
    baseSteps[approvedIndex].time = pickTime(item.approvedAt, item.updatedAt);
    baseSteps[borrowedIndex].state = "finish";
    baseSteps[borrowedIndex].time = pickTime(item.borrowedAt, item.updatedAt);
    baseSteps[returnedIndex].state = "finish";
    baseSteps[returnedIndex].time = pickTime(
      item.returnedPendingInspectionAt,
      item.endTimeActual,
      item.updatedAt,
    );
    baseSteps[lostDamagedIndex] = {
      key: "lost-damaged",
      label: "Hilang/Rusak",
      time: pickTime(item.lostDamagedAt, item.inspectedAt, item.updatedAt),
      state: "error",
    };
    return baseSteps.slice(0, lostDamagedIndex + 1);
  }

  return baseSteps;
}
