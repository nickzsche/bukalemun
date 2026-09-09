/**
 * Bukalemun — type definitions
 *
 * The runtime is plain ES5-compatible JavaScript with no build step; these
 * declarations exist so TypeScript consumers get completion and checking.
 */

export type SkinName =
  | 'default' | 'brutal' | 'glass' | 'neumorph' | 'skeuo' | 'terminal' | 'swiss'
  | 'memphis' | 'clay' | 'cyber' | 'pixel' | 'material' | 'minimal' | 'paper'
  | 'aurora' | 'blueprint' | 'deco' | 'bauhaus' | 'vapor' | 'organic' | 'aero'
  | 'sketch' | 'luxe' | 'y2k' | 'zen' | 'comic' | 'wireframe' | 'solarpunk'
  | 'retro70s' | 'pixelart' | 'riso'
  | 'gothic' | 'win95' | 'macclassic' | 'noir' | 'candy'
  | 'industrial' | 'herbarium' | 'typewriter' | 'magazine' | 'ledger'
  | 'nouveau' | 'holo' | 'thermal' | 'chalk' | 'neonsign'
  | 'denim' | 'marble' | 'space' | 'clinical' | 'origami';

export type ColorMode = 'light' | 'dark' | 'auto';
export type ResolvedMode = 'light' | 'dark';
/** The accent axis: the skin's own accent, or the same family rotated warmer or cooler. */
export type AccentName = 'none' | 'warm' | 'cool';

export type Placement =
  | 'top' | 'top-start' | 'top-end'
  | 'bottom' | 'bottom-start' | 'bottom-end'
  | 'left' | 'left-start' | 'left-end'
  | 'right' | 'right-start' | 'right-end';

/** Anything that can name an element: a selector, an id, or the node itself. */
export type Target = string | Element;

export interface SkinInfo {
  label: string;
  blurb: string;
  /** Google Fonts css2 `family=` spec for the skin's display face, or null for system faces. */
  fonts: string | null;
}

export interface ThemeState {
  style: SkinName;
  mode: ColorMode;
  resolved: ResolvedMode;
  accent: AccentName;
}

export interface Theme {
  readonly styles: SkinName[];
  readonly meta: Record<SkinName, SkinInfo>;
  info(name?: SkinName): SkinInfo;
  get(): ThemeState;
  getStyle(): SkinName;
  setStyle(name: SkinName, persist?: boolean): SkinName;
  next(step?: number): SkinName;
  prev(): SkinName;
  random(): SkinName;
  /** The Google Fonts stylesheet URL for a skin's display face, or null. */
  fonts(name?: SkinName): string | null;
  /** Fetch a skin's display face once (opt-in). Returns the <link>, or null. */
  loadFonts(name?: SkinName): HTMLLinkElement | null;
  getMode(): ColorMode;
  setMode(mode: ColorMode, persist?: boolean): ColorMode;
  resolved(): ResolvedMode;
  toggle(): ColorMode;
  /** The two generated variants, without 'none'. */
  readonly accents: AccentName[];
  accentInfo(name?: AccentName): SkinInfo;
  getAccent(): AccentName;
  setAccent(name: AccentName, persist?: boolean): AccentName;
  nextAccent(): AccentName;
  sync(): void;
  restore(): void;
  /** Returns an unsubscribe function. */
  onChange(fn: (state: ThemeState) => void): () => void;
  /**
   * Ship base + one skin and fetch the others on demand. `template` is the
   * per-skin stylesheet URL with `{skin}` in it; with no argument it is read
   * from `<script data-bk-skins>` (the no-flash tag). `null` turns it off.
   * Returns the template in force.
   */
  lazy(template?: string | null): string | null;
  /** Make sure a skin's stylesheet is present; `done` runs once it is (immediately if already there). Returns whether it already was. */
  ensure(name: SkinName, done?: () => void): boolean;
  /** Fetch skins ahead of time, one per idle slot. Defaults to all of them. */
  preload(names?: SkinName[]): void;
}

export interface ToastAction {
  label?: string;
  onClick?: () => void;
}

export interface ToastOptions {
  title?: string;
  message?: string;
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'loading';
  /** Milliseconds; 0 keeps it until dismissed. */
  duration?: number;
  position?:
    | 'top-start' | 'top-center' | 'top-end'
    | 'bottom-start' | 'bottom-center' | 'bottom-end';
  dismissible?: boolean;
  progress?: boolean;
  action?: ToastAction;
  onClose?: () => void;
}

export interface ToastHandle {
  readonly el: HTMLElement;
  dismiss(): void;
  update(patch: ToastOptions): ToastHandle;
}

export interface ToastApi {
  (options: ToastOptions | string): ToastHandle;
  success(message: string, options?: ToastOptions): ToastHandle;
  danger(message: string, options?: ToastOptions): ToastHandle;
  warning(message: string, options?: ToastOptions): ToastHandle;
  info(message: string, options?: ToastOptions): ToastHandle;
  loading(message: string, options?: ToastOptions): ToastHandle;
  dismissAll(): void;
  position(pos: NonNullable<ToastOptions['position']>): string;
  promise<T>(
    promise: Promise<T>,
    messages?: {
      loading?: string;
      success?: string | ((value: T) => string);
      error?: string | ((error: unknown) => string);
    }
  ): Promise<T>;
}

export interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export interface OverlayController {
  readonly el: HTMLElement;
  readonly kind: 'modal' | 'drawer';
  open(): OverlayController;
  close(reason?: string): OverlayController;
  toggle(): OverlayController;
  isOpen(): boolean;
  destroy(): void;
}

export interface OverlayApi {
  (target: Target, action?: 'open' | 'close' | 'toggle'): OverlayController | null;
  closeAll?(): void;
  top?(): OverlayController | null;
}

export interface Store<T extends object> {
  get(): T;
  get<K extends keyof T>(key: K): T[K];
  set(patch: Partial<T>): Store<T>;
  set<K extends keyof T>(key: K, value: T[K]): Store<T>;
  subscribe(fn: (state: T, changed: (keyof T)[]) => void, immediate?: boolean): () => void;
  reset(): Store<T>;
}

export interface PositionOptions {
  placement?: Placement;
  offset?: number;
  padding?: number;
  flip?: boolean;
  shift?: boolean;
  arrow?: HTMLElement | null;
  strategy?: 'absolute' | 'fixed';
}

export interface PositionResult {
  side: 'top' | 'bottom' | 'left' | 'right';
  align: string;
  x: number;
  y: number;
}

/** What a plugin's setup() may return; `destroy` is called on teardown. */
export interface PluginInstance {
  destroy?(): void;
  [key: string]: unknown;
}

export interface PluginSpec<T extends PluginInstance = PluginInstance> {
  /** Elements matching this are booted by bk.init(). */
  selector: string;
  setup(node: Element, options?: unknown): T | void;
  options?(node: Element): unknown;
}

export interface Bukalemun {
  readonly version: string;

  /* dom ------------------------------------------------------------------- */
  $(selector: Target, root?: ParentNode): Element | null;
  $$(selector: Target | ArrayLike<Element>, root?: ParentNode): Element[];
  el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs?: Record<string, unknown> | null,
    children?: (Node | string | null)[] | Node | string | null
  ): HTMLElementTagNameMap[K];
  on(
    target: Target | Window | Document | ArrayLike<Element>,
    type: string,
    handler: EventListenerOrEventListenerObject,
    opts?: boolean | AddEventListenerOptions
  ): () => void;
  delegate(
    root: Target | Document,
    type: string,
    selector: string,
    handler: (event: Event, match: Element) => void,
    opts?: boolean | AddEventListenerOptions
  ): () => void;
  emit(target: EventTarget, name: string, detail?: unknown, opts?: EventInit): boolean;
  ready(fn: () => void): void;
  resolve(target: Target, ctx?: Element): Element | null;
  uid(prefix?: string): string;
  data<T = unknown>(node: Element, key: string, fallback?: T): T;

  addClass(node: Element | null, cls: string): void;
  removeClass(node: Element | null, cls: string): void;
  toggleClass(node: Element | null, cls: string, force?: boolean): void;
  hasClass(node: Element | null, cls: string): boolean;

  throttle<F extends (...args: never[]) => void>(fn: F, wait: number): F;
  debounce<F extends (...args: never[]) => void>(fn: F, wait: number): F;
  raf(fn: FrameRequestCallback): number;
  prefersReducedMotion(): boolean;
  afterMotion(node: Element, cb: () => void, cap?: number): void;

  /* state ----------------------------------------------------------------- */
  store<T extends object>(initial: T): Store<T>;
  storage: {
    get(key: string, fallback?: string): string | undefined;
    set(key: string, value: string): string;
    remove(key: string): void;
  };

  /* focus & scroll -------------------------------------------------------- */
  focusables(root: ParentNode): HTMLElement[];
  trapFocus(
    container: HTMLElement,
    opts?: { autoFocus?: boolean; initial?: string }
  ): (restore?: boolean) => void;
  lockScroll(): void;
  unlockScroll(): void;

  /* positioning ----------------------------------------------------------- */
  position(anchor: Element, floating: HTMLElement, opts?: PositionOptions): PositionResult;
  autoPosition(anchor: Element, floating: HTMLElement, opts?: PositionOptions): () => void;

  /* components ------------------------------------------------------------ */
  theme: Theme;
  toast: ToastApi;
  modal: OverlayApi;
  drawer: OverlayApi;
  confirm(options: ConfirmOptions | string): Promise<boolean>;
  tooltip(target: Target): PluginInstance | undefined;
  popover(target: Target): PluginInstance | undefined;
  menu(target: Target): PluginInstance | undefined;
  closeFloats(except?: unknown): void;
  copy(text: string): Promise<void>;
  announce(message: string, assertive?: boolean): void;
  hotkey: {
    (combo: string, handler: (event: KeyboardEvent) => void, opts?: { allowInInput?: boolean }): () => void;
    label(combo: string): string;
  };
  loadbar: { start(): void; done(): void };

  /* registry -------------------------------------------------------------- */
  define<T extends PluginInstance>(name: string, spec: PluginSpec<T>): PluginSpec<T>;
  init(root?: ParentNode): ParentNode;
  observe(root?: Element): void;
  destroy(node: Element): void;
  instance<T = PluginInstance>(node: Element, name: string): T | undefined;
  plugins: Record<string, PluginSpec>;
  start(root?: ParentNode): Bukalemun;
}

declare const bk: Bukalemun;
export default bk;

export const version: Bukalemun['version'];
export const theme: Theme;
export const toast: ToastApi;
export const modal: OverlayApi;
export const drawer: OverlayApi;
export const confirm: Bukalemun['confirm'];
export const hotkey: Bukalemun['hotkey'];
export const copy: Bukalemun['copy'];
export const store: Bukalemun['store'];
export const init: Bukalemun['init'];
export const start: Bukalemun['start'];

declare global {
  interface Window {
    bk: Bukalemun;
    Bukalemun: Bukalemun;
    /** Set before the bundle loads to stop it auto-starting. */
    BUKALEMUN_MANUAL?: boolean;
  }
}
