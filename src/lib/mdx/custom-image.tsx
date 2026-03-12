import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";

export function CustomImage({
  className,
  ...props
}: React.ComponentProps<"img">) {
  const { src, alt, width, height } = props;

  if (!src || typeof src !== "string") {
    return null;
  }

  const imageWidth = width ? Number(width) : 1200;
  const imageHeight = height ? Number(height) : 630;

  // Generate dark mode image path by adding .dark before extension
  const darkSrc = src.replace(/^(.+)(\.[^.]+)$/, "$1.dark$2");

  // Check if dark variant exists in public directory
  const hasDarkImage =
    darkSrc !== src && existsSync(join(process.cwd(), "public", darkSrc));

  if (hasDarkImage) {
    return (
      <figure>
        <Image
          className={`block dark:hidden ${className ?? ""}`}
          src={src}
          alt={alt ?? "image"}
          width={imageWidth}
          height={imageHeight}
        />
        <Image
          className={`hidden dark:block ${className ?? ""}`}
          src={darkSrc}
          alt={alt ?? "image"}
          width={imageWidth}
          height={imageHeight}
        />
        {alt && <figcaption>{alt}</figcaption>}
      </figure>
    );
  }

  return (
    <figure>
      <Image
        className={className}
        src={src}
        alt={alt ?? "image"}
        width={imageWidth}
        height={imageHeight}
      />
      {alt && <figcaption>{alt}</figcaption>}
    </figure>
  );
}
