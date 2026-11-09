import monoMedium from "@fonts/geist/geist-mono/GeistMono-Medium.woff2";
import monoRegular from "@fonts/geist/geist-mono/GeistMono-Regular.woff2";
import sansMedium from "@fonts/geist/geist-sans/Geist-Medium.woff2";
import sansRegular from "@fonts/geist/geist-sans/Geist-Regular.woff2";
import sansSemiBold from "@fonts/geist/geist-sans/Geist-SemiBold.woff2";
import { cancelRender, continueRender, delayRender } from "remotion";
import { fonts } from "./theme";

const faces: [family: string, url: string, weight: string][] = [
  [fonts.sans, sansRegular, "400"],
  [fonts.sans, sansMedium, "500"],
  [fonts.sans, sansSemiBold, "600"],
  [fonts.mono, monoRegular, "400"],
  [fonts.mono, monoMedium, "500"],
];

// Every frame waits for the fonts, so none renders in a fallback.
const handle = delayRender("fonts");
Promise.all(
  faces.map(([family, url, weight]) =>
    new FontFace(family, `url(${url})`, { weight }).load(),
  ),
)
  .then((loaded) => {
    for (const face of loaded) document.fonts.add(face);
    continueRender(handle);
  })
  .catch((err) => cancelRender(err));
