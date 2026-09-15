// SHARED_DUMMY_PRODUCT_ENGAGEMENT_V1
//
// Sementara untuk tampilan engagement Diginaz.
// Nilai ditentukan oleh productId sehingga produk
// yang sama selalu mendapat angka yang sama.
//
// Tidak menulis data dummy ke Supabase.

export type StoreEngagement = {
  love: number;
  save: number;
  comment: number;
  share: number;
};

export function getDummyCardEngagement(
  productId: string
): StoreEngagement {
  let seed = 0;

  for (
    let index = 0;
    index < productId.length;
    index++
  ) {
    seed =
      (
        seed * 31 +
        productId.charCodeAt(index)
      ) >>> 0;
  }

  // DUMMY_COUNTS_RESET
  // Struktur engagement tetap dipertahankan.
  // Nilai sementara dikosongkan sampai data real digunakan.
  return {
    love: 0,
    save: 0,
    comment: 0,
    share: 0,
  };
}

export function formatEngagementCount(
  value: number
): string {
  const count =
    Math.max(
      0,
      Math.floor(
        Number(value) || 0
      )
    );

  if (count >= 1000000) {
    const millions =
      count / 1000000;

    return `${
      millions >= 10
        ? Math.floor(millions)
        : Number(
            millions.toFixed(1)
          )
    }M`;
  }

  if (count >= 1000) {
    const thousands =
      count / 1000;

    return `${
      thousands >= 10
        ? Math.floor(thousands)
        : Number(
            thousands.toFixed(1)
          )
    }K`;
  }

  return String(count);
}