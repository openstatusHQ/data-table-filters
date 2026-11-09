import { describe, expect, it } from "vitest";
import { cameraAt, TRAVEL, type Shot } from "./camera";

const W = 1920;
const H = 1080;
const overview: Shot = { at: 0, x: W / 2, y: H / 2, zoom: 1 };
const inOn: Shot = { at: 2, x: 400, y: 300, zoom: 2 };

describe("cameraAt", () => {
  it("holds the first shot until the next one starts", () => {
    expect(cameraAt([overview, inOn], 1.9, W, H)).toEqual({
      x: W / 2,
      y: H / 2,
      zoom: 1,
    });
  });

  it("arrives TRAVEL seconds after a shot starts and holds it", () => {
    const at = cameraAt([overview, inOn], 2 + TRAVEL, W, H);
    expect(at.zoom).toBeCloseTo(2);
    expect(at.x).toBeCloseTo(480);
    expect(at).toEqual(cameraAt([overview, inOn], 10, W, H));
  });

  it("zooms geometrically: halfway in time is sqrt of the ratio", () => {
    const mid = cameraAt([overview, inOn], 2 + TRAVEL / 2, W, H);
    expect(mid.zoom).toBeCloseTo(Math.SQRT2);
  });

  it("never shows past the edge of the scene", () => {
    const corner: Shot = { at: 0, x: 0, y: 0, zoom: 2 };
    expect(cameraAt([corner], 0, W, H)).toEqual({
      x: W / 4,
      y: H / 4,
      zoom: 2,
    });
  });
});
