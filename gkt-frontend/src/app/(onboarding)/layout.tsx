'use client';

import React from 'react';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  // Individual pages (onboarding/pricing/setup) render their own full layouts.
  // Keeping this layout minimal avoids stacked headers / extra top spacing.
  return <>{children}</>;
}
