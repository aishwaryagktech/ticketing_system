'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewProductPage() {
  const router = useRouter();

  useEffect(() => {
    // Super admins are no longer allowed to create products.
    // If someone lands here via an old link, send them back to the products dashboard.
    router.replace('/super-admin/products');
  }, [router]);

  return null;
}
