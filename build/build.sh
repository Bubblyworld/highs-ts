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

SCIP_VERSION="v10.0.1"

echo "Cloning SCIP ${SCIP_VERSION}..."
git clone --depth 1 --branch "${SCIP_VERSION}" https://github.com/scipopt/scip.git
cd scip
SCIP_DIR=$(pwd -P)

HIGHS_VERSION="v1.13.0"

echo "Cloning HiGHS ${HIGHS_VERSION}..."
mkdir -p extern
git clone --depth 1 --branch "${HIGHS_VERSION}" https://github.com/ERGO-Code/HiGHS.git extern/HiGHS

echo "Patching HiGHS negative-zero bug..."
cd extern/HiGHS
git apply "$ORIGINAL_DIR/patches/highs-signbit.patch"
cd ../..

echo "Building HiGHS for WASM..."
mkdir -p build-highs-wasm
cd build-highs-wasm

emcmake cmake ../extern/HiGHS \
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
cd ..

echo "Patching HiGHS CMake config..."
cat > build-highs-wasm/highs-targets.cmake << EOF
cmake_minimum_required(VERSION 3.10)

add_library(libhighs STATIC IMPORTED)

set_target_properties(libhighs PROPERTIES
  IMPORTED_LOCATION "${SCIP_DIR}/build-highs-wasm/lib/libhighs.a"
  INTERFACE_COMPILE_DEFINITIONS "LIBHIGHS_STATIC_DEFINE"
  INTERFACE_INCLUDE_DIRECTORIES "${SCIP_DIR}/extern/HiGHS/highs;${SCIP_DIR}/build-highs-wasm"
)
EOF

cat > build-highs-wasm/highs-config.cmake << 'EOF'
## HiGHS CMake configuration file (Emscripten-compatible)

set(_VERSION 1.12.0)

set(_HIGHS_HAVE_BLAS OFF)
set(HIGHS_HAVE_BLAS ${_HIGHS_HAVE_BLAS})

include("${CMAKE_CURRENT_LIST_DIR}/highs-targets.cmake")

if(NOT TARGET highs::highs)
    add_library(highs::highs ALIAS libhighs)
endif()

set(HIGHS_FOUND TRUE)
EOF

cp build-highs-wasm/highs-config.cmake build-highs-wasm/HIGHSConfig.cmake

echo "Creating dummy Threads module for Emscripten..."
mkdir -p cmake-modules
cat > cmake-modules/FindThreads.cmake << 'EOF'
# Dummy FindThreads for Emscripten - threads not supported
set(Threads_FOUND TRUE)
set(CMAKE_THREAD_LIBS_INIT "")
set(CMAKE_USE_PTHREADS_INIT FALSE)
set(THREADS_PREFER_PTHREAD_FLAG FALSE)

if(NOT TARGET Threads::Threads)
    add_library(Threads::Threads INTERFACE IMPORTED)
endif()
EOF

echo "Building SCIP for WASM..."
mkdir -p build-wasm
cd build-wasm

EXPORTED_FUNCTIONS="_SCIPcreate,_SCIPfree,_SCIPincludeDefaultPlugins,_SCIPreadProb,_SCIPsolve,_SCIPgetStatus,_SCIPgetBestSol,_SCIPgetSolVal,_SCIPgetSolOrigObj,_SCIPgetNVars,_SCIPgetVars,_SCIPgetNOrigVars,_SCIPgetOrigVars,_SCIPvarGetName,_SCIPsetIntParam,_SCIPsetRealParam,_SCIPsetLongintParam,_SCIPsetCharParam,_SCIPsetBoolParam,_SCIPsetStringParam,_malloc,_free,_main"
EXPORTED_RUNTIME_METHODS="ccall,cwrap,getValue,setValue,UTF8ToString,stringToUTF8,FS,HEAP8,HEAPU8,HEAP32"

EMSCRIPTEN_FLAGS="-O1 \
-sEXPORTED_FUNCTIONS=${EXPORTED_FUNCTIONS} \
-sEXPORTED_RUNTIME_METHODS=${EXPORTED_RUNTIME_METHODS} \
-sMODULARIZE=1 \
-sEXPORT_NAME=createSCIPModule \
-sEXPORT_ES6=1 \
-sENVIRONMENT=web,node \
-sALLOW_MEMORY_GROWTH=1 \
-sSTACK_SIZE=16777216 \
-sINVOKE_RUN=0 \
-sDISABLE_EXCEPTION_CATCHING=1"

emcmake cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_FLAGS="-DSCIP_NO_SIGACTION" \
    -DCMAKE_CXX_FLAGS="-DSCIP_NO_SIGACTION" \
    -DCMAKE_EXE_LINKER_FLAGS="${EMSCRIPTEN_FLAGS}" \
    -DCMAKE_EXE_LINKER_FLAGS_RELEASE="" \
    -DCMAKE_MODULE_PATH="$(pwd)/../cmake-modules" \
    -DLPS=highs \
    -DHIGHS_DIR="$(pwd)/../build-highs-wasm" \
    -DGMP=Off \
    -DZIMPL=Off \
    -DZLIB=Off \
    -DREADLINE=Off \
    -DPAPILO=Off \
    -DAMPL=Off \
    -DIPOPT=Off \
    -DTHREADSAFE=Off \
    -DTPI=none \
    -DSHARED=Off \
    -DBUILD_TESTING=Off

emmake make -j"$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)"
cd ..

echo "Copying SCIP module..."
cp build-wasm/bin/scip.js "$ORIGINAL_DIR/"
cp build-wasm/bin/scip.wasm "$ORIGINAL_DIR/"

echo ""
echo "Build complete!"
echo "Output files:"
echo "  $ORIGINAL_DIR/scip.js"
echo "  $ORIGINAL_DIR/scip.wasm"
