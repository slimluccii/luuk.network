import type { Transform } from "style-dictionary/types";

/**
 * Modular fluid sizing. A `fluid-size` token references a `fluid-scale`
 * definition and picks an integer `step` on it:
 *
 *   { "scale": "{Fluid.Typography}", "step": -1 }
 *
 * The size at a step is `base · ratio^step`, computed at each endpoint of the
 * referenced scale, then fluid-interpolated across the width range into a
 * `clamp()`. Each token names its own scale, so a new role is one line and the
 * whole hierarchy retunes from the `Fluid.*` endpoints.
 */
const ROOT_FONT_SIZE = 16;
const px = (value: string) => parseFloat(value);
const round = (n: number) => Math.round(n * 1e4) / 1e4;

type Endpoint = { width: string; size: string; scale: number };
type FluidSize = { scale: { min: Endpoint; max: Endpoint }; step: number };

const fluidSize: Transform = {
  name: "size/fluid-size",
  type: "value",
  // Transitive so the `{Fluid.*}` reference resolves before this runs.
  transitive: true,
  filter: (token) => token.$type === "fluid-size",
  transform: (token) => {
    const { scale, step } = token.$value as FluidSize;
    const { min, max } = scale;

    const minRem = px(min.size) * min.scale ** step;
    const maxRem = px(max.size) * max.scale ** step;
    const minVp = px(min.width) / ROOT_FONT_SIZE;
    const maxVp = px(max.width) / ROOT_FONT_SIZE;

    const slope = (maxRem - minRem) / (maxVp - minVp);
    const intercept = minRem - slope * minVp;

    // Explicit sign: descending steps give a negative vw coefficient, and
    // Safari rejects `A + -Bvw` (falls back to inherit), so emit `A - Bvw`.
    const vw = round(slope * 100);
    const preferred = `${round(intercept)}rem ${vw < 0 ? "-" : "+"} ${Math.abs(vw)}vw`;
    const lo = round(Math.min(minRem, maxRem));
    const hi = round(Math.max(minRem, maxRem));

    return `clamp(${lo}rem, ${preferred}, ${hi}rem)`;
  },
};

export default fluidSize;
