"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, ChevronDown, Globe, Search } from "lucide-react";
import {
  detectBrowserTimezone,
  formatLocalClock,
  formatOffset,
  isValidTimezone,
  listIanaTimezones,
  timezoneCity,
  timezoneMatches,
  timezoneRegion,
} from "@/lib/timezones";
import { cn } from "@/lib/utils";

type Tone = "default" | "compact" | "ghost";

type Props = {
  value: string;
  onChange: (timezone: string) => void;
  /** Hidden form field name; omit to skip form submission. */
  name?: string;
  /** Optional override for the detected zone shown as the "Use my timezone" row. */
  detectedTimezone?: string;
  /** Disable the trigger; useful for read-only displays. */
  disabled?: boolean;
  /** "default" matches the dashboard tone; "compact" is for the public booking. */
  tone?: Tone;
  /** Optional className applied to the trigger button. */
  className?: string;
};

export function TimezoneCombobox({
  value,
  onChange,
  name,
  detectedTimezone,
  disabled = false,
  tone = "default",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const detected = useMemo(
    () => detectedTimezone ?? detectBrowserTimezone(),
    [detectedTimezone],
  );

  const zones = useMemo(() => {
    const list = listIanaTimezones();
    if (!list.includes(value) && isValidTimezone(value)) {
      return [value, ...list];
    }
    return list;
  }, [value]);

  const filtered = useMemo(() => {
    if (!query) return zones;
    return zones.filter((zone) => timezoneMatches(zone, query));
  }, [zones, query]);

  // Group by region for the dropdown
  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const zone of filtered) {
      const region = timezoneRegion(zone);
      const bucket = map.get(region) ?? [];
      bucket.push(zone);
      map.set(region, bucket);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const flatOptions = useMemo(() => filtered, [filtered]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function openPanel() {
    setQuery("");
    setActiveIndex(Math.max(0, flatOptions.indexOf(value)));
    setOpen(true);
  }

  function togglePanel() {
    if (open) {
      setOpen(false);
    } else {
      openPanel();
    }
  }

  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>(
      "[data-tz-active='true']",
    );
    if (active) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, open]);

  function commit(zone: string) {
    onChange(zone);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((idx) => Math.min(idx + 1, flatOptions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((idx) => Math.max(idx - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const zone = flatOptions[activeIndex];
      if (zone) commit(zone);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  const offset = formatOffset(value);
  const city = timezoneCity(value);
  const clock = formatLocalClock(value);

  const triggerClass = cn(
    "flex w-full items-center gap-3 rounded-xl border bg-surface-card text-left transition",
    tone === "compact"
      ? "h-10 border-line-soft px-3 text-sm hover:border-brand/40"
      : tone === "ghost"
        ? "h-10 border-transparent bg-transparent px-2 text-sm hover:bg-surface-page"
        : "h-12 border-line-warm bg-surface-page px-4 text-sm hover:border-brand/40",
    open && "border-brand shadow-[0_0_0_4px_rgba(255,95,99,0.15)]",
    disabled && "cursor-not-allowed opacity-60",
    className,
  );

  return (
    <div ref={wrapperRef} className="relative">
      {name ? <input type="hidden" name={name} value={value} /> : null}

      <button
        type="button"
        disabled={disabled}
        onClick={togglePanel}
        className={triggerClass}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe className="size-4 shrink-0 text-ink-muted" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-semibold text-ink-strong">{city}</p>
          <p className="truncate text-[11px] text-ink-soft tabular-nums">
            {value}
            <span className="mx-1 text-ink-faint">·</span>
            {offset}
            {clock ? (
              <>
                <span className="mx-1 text-ink-faint">·</span>
                {clock}
              </>
            ) : null}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-ink-muted transition",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-xl border border-line-cream bg-surface-card shadow-[0_24px_48px_-20px_rgba(17,24,39,0.16)]">
          <div className="flex items-center gap-2 border-b border-line-cream px-3 py-2.5">
            <Search className="size-4 shrink-0 text-ink-muted" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              placeholder="Search city or zone…"
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-muted"
            />
            <kbd className="hidden rounded border border-line-cream bg-surface-page px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted sm:inline">
              esc
            </kbd>
          </div>

          {detected && detected !== value ? (
            <button
              type="button"
              onClick={() => commit(detected)}
              className="flex w-full items-center gap-2 border-b border-line-cream bg-surface-page px-3 py-2 text-left text-[12px] font-semibold text-ink-strong hover:bg-brand-tint-100"
            >
              <Globe className="size-3.5 text-brand" />
              Use my timezone — {timezoneCity(detected)} ({formatOffset(detected)})
            </button>
          ) : null}

          <div
            ref={listRef}
            role="listbox"
            className="max-h-[280px] overflow-y-auto py-1"
          >
            {flatOptions.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-ink-muted">
                No timezones match &ldquo;{query}&rdquo;.
              </p>
            ) : (
              grouped.map(([region, items]) => (
                <div key={region} className="px-1.5 pb-1">
                  <p className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                    {region}
                  </p>
                  {items.map((zone) => {
                    const index = flatOptions.indexOf(zone);
                    const isSelected = zone === value;
                    const isActive = index === activeIndex;
                    return (
                      <button
                        key={zone}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        data-tz-active={isActive ? "true" : "false"}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => commit(zone)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition",
                          isActive
                            ? "bg-brand-tint-100 text-ink-strong"
                            : "text-ink-body hover:bg-surface-page",
                        )}
                      >
                        <span className="flex-1 truncate">
                          <span className="font-semibold">
                            {timezoneCity(zone)}
                          </span>{" "}
                          <span className="text-[11px] text-ink-muted tabular-nums">
                            {zone}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold text-ink-soft tabular-nums">
                          {formatOffset(zone)}
                        </span>
                        {isSelected ? (
                          <Check className="size-3.5 text-brand" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
