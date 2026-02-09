#!/usr/bin/env bash
set -euo pipefail

check_dependency() {
    if ! command -v "$1" &> /dev/null; then
        echo "Error: $1 is not installed or not in PATH"
        echo "$2"
        exit 1
    fi
}

check_dependency "emcmake" "Install Emscripten: https://emscripten.org/docs/getting_started/downloads.html"
check_dependency "emmake" "Install Emscripten: https://emscripten.org/docs/getting_started/downloads.html"
check_dependency "cmake" "Install CMake 3.10+: https://cmake.org/download/"
check_dependency "git" "Install git: https://git-scm.com/downloads"

CMAKE_VERSION=$(cmake --version | head -n1 | grep -oE '[0-9]+\.[0-9]+' | head -n1)
CMAKE_MAJOR=$(echo "$CMAKE_VERSION" | cut -d. -f1)
CMAKE_MINOR=$(echo "$CMAKE_VERSION" | cut -d. -f2)
if [ "$CMAKE_MAJOR" -lt 3 ] || { [ "$CMAKE_MAJOR" -eq 3 ] && [ "$CMAKE_MINOR" -lt 10 ]; }; then
    echo "Error: CMake 3.10+ required, found $CMAKE_VERSION"
    exit 1
fi

ORIGINAL_DIR="$(pwd)"
TEMP_DIR=$(mktemp -d)

cleanup() {
    echo "Cleaning up temporary directory..."
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo "Working in temporary directory: $TEMP_DIR"
cd "$TEMP_DIR"
TEMP_DIR=$(pwd -P)

HIGHS_VERSION="v1.13.0"

echo "Cloning HiGHS ${HIGHS_VERSION}..."
git clone --depth 1 --branch "${HIGHS_VERSION}" https://github.com/ERGO-Code/HiGHS.git
cd HiGHS

echo "Patching HiGHS negative-zero bug..."
git apply "$ORIGINAL_DIR/patches/highs-signbit.patch"

cd "$TEMP_DIR"

echo "Building HiGHS for WASM..."
mkdir -p build-highs
cd build-highs

emcmake cmake ../HiGHS \
    -DCMAKE_BUILD_TYPE=Release \
    -DZLIB=OFF \
    -DFAST_BUILD=OFF \
    -DBUILD_SHARED_LIBS=OFF \
    -DHIGHS_NO_DEFAULT_THREADS=ON \
    -DBUILD_CXX=ON \
    -DFORTRAN=OFF \
    -DCSHARP=OFF \
    -DPYTHON_BUILD_SETUP=OFF

emmake make -j"$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)"
cd "$TEMP_DIR"

echo "Linking HiGHS WASM module..."
cat > main.c << 'EOF'
int main() { return 0; }
EOF

EXPORTED_FUNCTIONS="_Highs_create,_Highs_destroy,_Highs_readModel,_Highs_run,_Highs_getModelStatus,_Highs_getObjectiveValue,_Highs_getNumCol,_Highs_getSolution,_Highs_getColName,_Highs_setBoolOptionValue,_Highs_setIntOptionValue,_Highs_setDoubleOptionValue,_Highs_setStringOptionValue,_malloc,_free,_main"
EXPORTED_RUNTIME_METHODS="ccall,cwrap,getValue,setValue,UTF8ToString,stringToUTF8,FS,HEAP8,HEAPU8,HEAP32"

emcc main.c \
    -O1 \
    -Ibuild-highs \
    -IHiGHS/src \
    -Lbuild-highs/lib \
    -lhighs \
    -sEXPORTED_FUNCTIONS="${EXPORTED_FUNCTIONS}" \
    -sEXPORTED_RUNTIME_METHODS="${EXPORTED_RUNTIME_METHODS}" \
    -sMODULARIZE=1 \
    -sEXPORT_NAME=createHiGHSModule \
    -sEXPORT_ES6=1 \
    -sENVIRONMENT=web,node \
    -sALLOW_MEMORY_GROWTH=1 \
    -sSTACK_SIZE=16777216 \
    -sINVOKE_RUN=0 \
    -sDISABLE_EXCEPTION_CATCHING=1 \
    -o highs.js

echo "Copying HiGHS module..."
cp highs.js "$ORIGINAL_DIR/"
cp highs.wasm "$ORIGINAL_DIR/"

echo ""
echo "Build complete!"
echo "Output files:"
echo "  $ORIGINAL_DIR/highs.js"
echo "  $ORIGINAL_DIR/highs.wasm"
