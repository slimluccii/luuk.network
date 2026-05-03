const formatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

type DateInput = Date | string | number;

export function formatDateRange(
  startDate: DateInput,
  endDate?: DateInput,
): string {
  const start = formatter.format(new Date(startDate));
  const end = endDate ? formatter.format(new Date(endDate)) : "present";
  return `${start} - ${end}`;
}
