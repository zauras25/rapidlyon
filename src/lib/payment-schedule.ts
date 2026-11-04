import "server-only";

const amountPattern = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
export type ProjectPaymentInstallment = {
  sequence: 1 | 2 | 3;
  stage: "advance" | "agreed_milestone" | "final";
  label: string;
  percentage: 40 | 30;
  amount: string;
  currency: "USD" | "PKR";
  dueTrigger: string;
  milestone_position?: number;
};

function toMinorUnits(amount: string): number {
  if (!amountPattern.test(amount)) {
    throw new Error("Enter a valid project total with no more than two decimal places.");
  }
  const [whole, fraction = ""] = amount.split(".");
  const minorUnits = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minorUnits)) {
    throw new Error("The project total is outside the supported range.");
  }
  return minorUnits;
}

function fromMinorUnits(amount: number): string {
  const whole = Math.floor(amount / 100);
  const fraction = amount % 100;
  return `${whole}.${fraction.toString().padStart(2, "0")}`;
}

export function createProjectPaymentSchedule(
  amount: string,
  currency: string,
  milestonePosition = 1,
): ProjectPaymentInstallment[] {
  if (currency !== "USD" && currency !== "PKR") {
    throw new Error("Choose USD or PKR for the project contract.");
  }
  if (!Number.isInteger(milestonePosition) || milestonePosition < 1 || milestonePosition > 50) {
    throw new Error("Choose a valid agreed milestone for the milestone installment.");
  }

  const totalMinor = toMinorUnits(amount);
  if (totalMinor < 3) {
    throw new Error("The project total must be at least 0.03 to create three payment installments.");
  }

  const advanceMinor = Math.floor((totalMinor * 40 + 50) / 100);
  const milestoneMinor = Math.floor((totalMinor * 30 + 50) / 100);
  const finalMinor = totalMinor - advanceMinor - milestoneMinor;

  if (advanceMinor < 1 || milestoneMinor < 1 || finalMinor < 1) {
    throw new Error("The project total is too small to split into three positive installments.");
  }

  const contractCurrency = currency;
  return [
    {
      sequence: 1,
      stage: "advance",
      label: "Advance payment",
      percentage: 40,
      amount: fromMinorUnits(advanceMinor),
      currency: contractCurrency,
      dueTrigger: "After agreement acceptance and before project kickoff.",
    },
    {
      sequence: 2,
      stage: "agreed_milestone",
      label: "Agreed milestone payment",
      percentage: 30,
      amount: fromMinorUnits(milestoneMinor),
      currency: contractCurrency,
      dueTrigger: "At the milestone identified in the accepted agreement.",
      milestone_position: milestonePosition,
    },
    {
      sequence: 3,
      stage: "final",
      label: "Final payment",
      percentage: 30,
      amount: fromMinorUnits(finalMinor),
      currency: contractCurrency,
      dueTrigger: "After final approval and before handover.",
    },
  ];
}
