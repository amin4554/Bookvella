import Image from "next/image";

type BrandLogoProps = {
  inverse?: boolean;
  /**
   * "lockup" renders the icon + wordmark side by side.
   * "icon" renders just the square mark.
   */
  variant?: "lockup" | "icon";
  size?: "sm" | "md" | "lg";
};

const ICON_SIZES: Record<NonNullable<BrandLogoProps["size"]>, number> = {
  sm: 28,
  md: 32,
  lg: 40,
};

const WORDMARK_HEIGHT: Record<NonNullable<BrandLogoProps["size"]>, number> = {
  sm: 22,
  md: 26,
  lg: 32,
};

export function BrandLogo({
  inverse = false,
  variant = "lockup",
  size = "md",
}: BrandLogoProps) {
  const iconPx = ICON_SIZES[size];
  const wordPx = WORDMARK_HEIGHT[size];
  const iconSrc = inverse ? "/logo/icon-white.svg" : "/logo/icon.svg";

  if (variant === "icon") {
    return (
      <Image
        src={iconSrc}
        alt="Bookvella"
        width={iconPx}
        height={iconPx}
        priority
        className="rounded-[7px]"
      />
    );
  }

  // Lockup: icon + "Bookvella" word
  return (
    <div className="flex items-center gap-2.5">
      <Image
        src={iconSrc}
        alt=""
        width={iconPx}
        height={iconPx}
        priority
        className="rounded-[7px]"
      />
      <span
        className={`font-bold tracking-tight ${
          inverse ? "text-white" : "text-[#0B1220]"
        }`}
        style={{ fontSize: wordPx * 0.62, letterSpacing: "-0.02em" }}
      >
        Bookvella
      </span>
    </div>
  );
}
