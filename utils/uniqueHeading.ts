export const makeUniqueHeading = (
  heading: string,
  existing: Array<{ heading: string }>,
): string => {
  let result = heading;
  let suffix = 2;
  while (existing.some(ch => ch.heading === result)) {
    result = `${heading} (${String(suffix)})`;
    suffix += 1;
  }
  return result;
};
