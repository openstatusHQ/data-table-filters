import { Client } from "./client";
import {
  DEFAULT_MANIFEST,
  MANIFEST_PARAM,
  parseManifestInput,
} from "./endpoint";

/**
 * The table on this page has no schema of its own. It reads the manifest URL
 * from `?manifest=` and renders whatever that endpoint describes.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const param = (await searchParams)[MANIFEST_PARAM];
  const input = (Array.isArray(param) ? param[0] : param) ?? DEFAULT_MANIFEST;

  return <Client input={input} target={parseManifestInput(input)} />;
}
