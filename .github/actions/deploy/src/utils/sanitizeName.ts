import slugify from "@sindresorhus/slugify";

export const sanitizeName = (name: string): string => {
  return slugify(name, {
    lowercase: true,
    separator: "-",
    decamelize: true,
    customReplacements: [
      ["/", "-"],
      ["_", "-"],
      [".", "-"],
    ],
  });
};
