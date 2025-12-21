import { Input } from "@heroui/react";

export function Overlay() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-transparent m-0 p-0 overflow-hidden">
      <div>
        <Input
          aria-label="Name"
          className="w-64"
          placeholder="Enter your name"
        />
      </div>
    </div>
  );
}
