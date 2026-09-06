"use client";

import React, { Suspense } from "react";
import SportBuilderStudio from "@/components/sport-builder/SportBuilderStudio";

export default function IntakePage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 bg-[#070A14] flex items-center justify-center text-slate-400 text-xs">
          Loading Sports Intake Studio...
        </div>
      }
    >
      <SportBuilderStudio />
    </Suspense>
  );
}
