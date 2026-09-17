import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  StoreProductCardItem,
} from "./storeProducts";

const STORE_PRODUCTS_CACHE_KEY =
  "diginaz:store-products:v4";

export async function readStoreProductsCache():
  Promise<StoreProductCardItem[] | null> {

  try {
    const raw =
      await AsyncStorage.getItem(
        STORE_PRODUCTS_CACHE_KEY
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed as StoreProductCardItem[];
  }
  catch (error) {
    console.warn(
      "Gagal membaca cache Store:",
      error
    );

    return null;
  }
}

export async function writeStoreProductsCache(
  products: StoreProductCardItem[]
) {
  try {
    await AsyncStorage.setItem(
      STORE_PRODUCTS_CACHE_KEY,
      JSON.stringify(products)
    );
  }
  catch (error) {
    console.warn(
      "Gagal menyimpan cache Store:",
      error
    );
  }
}