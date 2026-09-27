/// <reference types="nativewind/types" />

// global.css is consumed by NativeWind's Metro transformer; TS 6 checks side-effect imports, so declare it.
declare module '*.css';
