export const PRODUCT_VERSION = 1;
export const BUILD_NUMBER = 14;
export const PRODUCT_VERSION_LABEL = `Version ${PRODUCT_VERSION} · Build ${BUILD_NUMBER}`;

export const productVersion = {
  version: PRODUCT_VERSION,
  build: BUILD_NUMBER,
  label: PRODUCT_VERSION_LABEL,
} as const;
