import { cn } from "@/lib/utils";

/**
 * Cursor-style logo: caret/cursor icon + brand mark.
 * Inspired by Cursor's editor identity.
 */
export function CursorLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      aria-label="CursorContext Architect"
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Block cursor shape */}
        <path
          d="M7 2v20h2l4-6-4-6-2 0 4-6H7z"
          fill="currentColor"
          className="text-white"
        />
      </svg>
      <span className="text-sm font-semibold tracking-tight text-white">
        CursorContext
      </span>
    </div>
  );
}
