import { CircleNotch } from "@phosphor-icons/react/dist/ssr";

export default function Loading() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <CircleNotch className="size-8 animate-spin text-primary" />
      </div>
    </div>
  );
}
