import Image from "next/image";

export function BrandLogo({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/bookvella-icon.png"
        alt=""
        width={40}
        height={40}
        className="size-10 rounded-xl object-contain"
      />
      <span className={inverse ? "text-xl font-bold text-white" : "text-xl font-bold text-[#111827]"}>
        Bookvella
      </span>
    </div>
  );
}
