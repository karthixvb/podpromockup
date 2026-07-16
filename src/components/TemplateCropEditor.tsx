"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useRouter } from "next/navigation";
import { parseJson } from "@/lib/pod";

const CANVAS_W = 600;
const CANVAS_H = 500;

export type CropRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TemplateScene = {
  id: string;
  variantId: string;
  name: string;
  imageUrl: string | null;
  cropRegion: string;
  useLightImage: boolean;
  useDarkImage: boolean;
  isPrimary: boolean;
  sortOrder: number;
};

export type TemplateVariant = {
  id: string;
  name: string;
  colorHex: string;
  isPrimary: boolean;
  scenes: TemplateScene[];
};

export type TemplateForEditor = {
  id: string;
  name: string;
  variants: TemplateVariant[];
};

type DragMode =
  | "nw"
  | "ne"
  | "sw"
  | "se"
  | "n"
  | "s"
  | "w"
  | "e"
  | "move"
  | null;

type ActionResult = {
  ok?: boolean;
  message?: string;
  error?: string;
  imageUrl?: string;
  sceneId?: string;
  syncedAt?: number;
  cropRegion?: string;
};

function getHandle(
  mx: number,
  my: number,
  cr: CropRegion,
  threshold = 10,
): DragMode {
  const { x, y, width, height } = cr;
  const r = x + width;
  const b = y + height;
  const midX = x + width / 2;
  const midY = y + height / 2;

  if (Math.abs(mx - x) < threshold && Math.abs(my - y) < threshold) return "nw";
  if (Math.abs(mx - r) < threshold && Math.abs(my - y) < threshold) return "ne";
  if (Math.abs(mx - x) < threshold && Math.abs(my - b) < threshold) return "sw";
  if (Math.abs(mx - r) < threshold && Math.abs(my - b) < threshold) return "se";
  if (Math.abs(mx - midX) < width / 2 && Math.abs(my - y) < threshold) return "n";
  if (Math.abs(mx - midX) < width / 2 && Math.abs(my - b) < threshold) return "s";
  if (Math.abs(mx - x) < threshold && Math.abs(my - midY) < height / 2) return "w";
  if (Math.abs(mx - r) < threshold && Math.abs(my - midY) < height / 2) return "e";
  if (mx >= x && mx <= r && my >= y && my <= b) return "move";
  return null;
}

function getCursorStyle(mode: DragMode): string {
  switch (mode) {
    case "nw":
    case "se":
      return "nwse-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    case "move":
      return "move";
    default:
      return "default";
  }
}

type Props = {
  template: TemplateForEditor;
};

/**
 * Visual template editor — crop canvas + variants/scenes.
 */
export function TemplateCropEditor({ template }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastMsgKey = useRef("");

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    template.variants[0]?.id || null,
  );
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(
    template.variants[0]?.scenes?.[0]?.id || null,
  );
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantColor, setNewVariantColor] = useState("#FFFFFF");
  const [newSceneName, setNewSceneName] = useState("");
  const [cropRegion, setCropRegion] = useState<CropRegion>({
    x: 50,
    y: 50,
    width: 200,
    height: 250,
  });
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragCropStart, setDragCropStart] = useState<CropRegion>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [imageLoaded, setImageLoaded] = useState<HTMLImageElement | null>(null);
  const [cursorStyle, setCursorStyle] = useState("default");
  const [statusMsg, setStatusMsg] = useState("");
  const [flagOverrides, setFlagOverrides] = useState<
    Record<string, Partial<Pick<TemplateScene, "useLightImage" | "useDarkImage">>>
  >({});
  const [busy, setBusy] = useState(false);

  const selectedVariant =
    template.variants.find((v) => v.id === selectedVariantId) || null;
  const scenes = (selectedVariant?.scenes || []).map((s) => {
    const o = flagOverrides[s.id];
    return o ? { ...s, ...o } : s;
  });
  const selectedScene = scenes.find((s) => s.id === selectedSceneId) || null;

  useEffect(() => {
    if (!selectedVariantId && template.variants[0]) {
      setSelectedVariantId(template.variants[0].id);
      setSelectedSceneId(template.variants[0].scenes?.[0]?.id || null);
    }
  }, [template, selectedVariantId]);

  useEffect(() => {
    setFlagOverrides({});
  }, [template]);

  const drawCanvas = useCallback((img: HTMLImageElement | null, cr: CropRegion) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!img) {
      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#999";
      ctx.textAlign = "center";
      ctx.font = "14px sans-serif";
      ctx.fillText(
        "Upload a mockup image for this scene",
        canvas.width / 2,
        canvas.height / 2,
      );
      return;
    }

    const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const ox = (canvas.width - w) / 2;
    const oy = (canvas.height - h) / 2;

    ctx.drawImage(img, ox, oy, w, h);

    ctx.strokeStyle = "#16a34a";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(cr.x, cr.y, cr.width, cr.height);
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(22, 163, 74, 0.1)";
    ctx.fillRect(cr.x, cr.y, cr.width, cr.height);

    const corners: [number, number][] = [
      [cr.x, cr.y],
      [cr.x + cr.width, cr.y],
      [cr.x, cr.y + cr.height],
      [cr.x + cr.width, cr.y + cr.height],
    ];
    ctx.fillStyle = "#16a34a";
    corners.forEach(([hx, hy]) => {
      ctx.fillRect(hx - 5, hy - 5, 10, 10);
    });

    const edges: [number, number][] = [
      [cr.x + cr.width / 2, cr.y],
      [cr.x + cr.width / 2, cr.y + cr.height],
      [cr.x, cr.y + cr.height / 2],
      [cr.x + cr.width, cr.y + cr.height / 2],
    ];
    edges.forEach(([hx, hy]) => {
      ctx.fillRect(hx - 4, hy - 4, 8, 8);
    });
  }, []);

  const loadScene = useCallback(
    (scene: TemplateScene | null) => {
      if (!scene) {
        setSelectedSceneId(null);
        setImageLoaded(null);
        drawCanvas(null, cropRegion);
        return;
      }
      setSelectedSceneId(scene.id);
      const cr = parseJson<CropRegion>(scene.cropRegion, {
        x: 50,
        y: 50,
        width: 200,
        height: 250,
      });
      setCropRegion(cr);
      if (scene.imageUrl) {
        const img = new window.Image();
        img.onload = () => {
          setImageLoaded(img);
          drawCanvas(img, cr);
        };
        img.onerror = () => {
          setImageLoaded(null);
          drawCanvas(null, cr);
          setStatusMsg(`Could not load image: ${scene.imageUrl}`);
        };
        img.src = scene.imageUrl;
      } else {
        setImageLoaded(null);
        drawCanvas(null, cr);
      }
    },
    [cropRegion, drawCanvas],
  );

  useEffect(() => {
    if (selectedScene) loadScene(selectedScene);
    // Reload when imageUrl arrives after upload
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSceneId, selectedVariantId, template.id, selectedScene?.imageUrl]);

  useEffect(() => {
    drawCanvas(imageLoaded, cropRegion);
  }, [cropRegion, imageLoaded, drawCanvas]);

  const handleActionResult = useCallback(
    (data: ActionResult) => {
      const key = `${data.message || ""}|${data.error || ""}|${data.ok}|${data.imageUrl || ""}|${data.syncedAt || ""}`;
      if (key === lastMsgKey.current) return;
      lastMsgKey.current = key;
      if (data.message) setStatusMsg(data.message);
      if (data.error) setStatusMsg(`Error: ${data.error}`);
      if (data.ok && data.imageUrl && data.sceneId === selectedSceneId) {
        const url = data.imageUrl;
        const img = new window.Image();
        img.onload = () => setImageLoaded(img);
        img.onerror = () =>
          setStatusMsg(
            `Upload succeeded but the image is not publicly accessible. Try opening: ${url}`,
          );
        img.src = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
      }
    },
    [selectedSceneId],
  );

  const getCanvasPos = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { mx: 0, my: 0 };
    const scaleX = (canvasRef.current?.width || CANVAS_W) / rect.width;
    const scaleY = (canvasRef.current?.height || CANVAS_H) / rect.height;
    return {
      mx: (e.clientX - rect.left) * scaleX,
      my: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleCanvasMouseDown = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const { mx, my } = getCanvasPos(e);
    const mode = getHandle(mx, my, cropRegion);
    if (!mode) return;
    setDragMode(mode);
    setDragStart({ x: mx, y: my });
    setDragCropStart({ ...cropRegion });
  };

  const handleCanvasMouseMove = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const { mx, my } = getCanvasPos(e);
    if (!dragMode) {
      setCursorStyle(getCursorStyle(getHandle(mx, my, cropRegion)));
      return;
    }
    const dx = mx - dragStart.x;
    const dy = my - dragStart.y;
    const { x, y, width, height } = dragCropStart;
    const minSize = 30;
    let next = dragCropStart;
    switch (dragMode) {
      case "move":
        next = {
          ...dragCropStart,
          x: Math.max(0, x + dx),
          y: Math.max(0, y + dy),
        };
        break;
      case "se":
        next = {
          ...dragCropStart,
          width: Math.max(minSize, width + dx),
          height: Math.max(minSize, height + dy),
        };
        break;
      case "nw":
        next = {
          x: x + dx,
          y: y + dy,
          width: Math.max(minSize, width - dx),
          height: Math.max(minSize, height - dy),
        };
        break;
      case "ne":
        next = {
          ...dragCropStart,
          y: y + dy,
          width: Math.max(minSize, width + dx),
          height: Math.max(minSize, height - dy),
        };
        break;
      case "sw":
        next = {
          ...dragCropStart,
          x: x + dx,
          width: Math.max(minSize, width - dx),
          height: Math.max(minSize, height + dy),
        };
        break;
      case "n":
        next = {
          ...dragCropStart,
          y: y + dy,
          height: Math.max(minSize, height - dy),
        };
        break;
      case "s":
        next = { ...dragCropStart, height: Math.max(minSize, height + dy) };
        break;
      case "w":
        next = {
          ...dragCropStart,
          x: x + dx,
          width: Math.max(minSize, width - dx),
        };
        break;
      case "e":
        next = { ...dragCropStart, width: Math.max(minSize, width + dx) };
        break;
      default:
        break;
    }
    setCropRegion(next);
  };

  const submit = async (
    intent: string,
    fields: Record<string, string | number | boolean | null | undefined> = {},
    file?: File,
  ) => {
    const fd = new FormData();
    fd.set("intent", intent);
    Object.entries(fields).forEach(([k, v]) => {
      if (v != null) fd.set(k, String(v));
    });
    if (file) fd.set("file", file);

    setBusy(true);
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as ActionResult;
      handleActionResult(data);
      if (data.ok || res.ok) {
        router.refresh();
      }
    } catch {
      setStatusMsg("Error: Network error");
    } finally {
      setBusy(false);
    }
  };

  const uploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedScene) return;

    const previewUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      setImageLoaded(img);
      URL.revokeObjectURL(previewUrl);
    };
    img.src = previewUrl;
    setStatusMsg("Uploading image…");

    void submit("upload_scene_image", { id: selectedScene.id }, file);
    e.target.value = "";
  };

  const toggleFlag = (
    scene: TemplateScene,
    field: "useLightImage" | "useDarkImage",
    checked: boolean,
  ) => {
    setFlagOverrides((prev) => ({
      ...prev,
      [scene.id]: {
        ...(prev[scene.id] || {}),
        [field]: checked,
      },
    }));
    void submit("toggle_scene_flag", {
      id: scene.id,
      field,
      value: checked ? "1" : "0",
    });
  };

  return (
    <div className="grid gap-4">
      {statusMsg ? (
        <div
          className={`flex items-start justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-sm break-all ${
            statusMsg.startsWith("Error")
              ? "border-danger/40 bg-danger/5 text-danger"
              : "border-accent/30 bg-accent/5 text-accent"
          }`}
        >
          <span>{statusMsg}</span>
          <button
            type="button"
            onClick={() => setStatusMsg("")}
            className="shrink-0 cursor-pointer opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 items-start lg:grid-cols-[minmax(200px,260px)_minmax(180px,220px)_1fr]">
        {/* Variants */}
        <div className="rounded-xl border border-border bg-panel p-4">
          <h3 className="mb-3 text-base font-semibold">Variants</h3>
          {template.variants.map((v) => (
            <div
              key={v.id}
              className={`mb-1.5 flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 ${
                v.id === selectedVariantId
                  ? "border border-accent bg-accent/5"
                  : "border border-transparent hover:bg-background"
              }`}
              onClick={() => {
                setSelectedVariantId(v.id);
                setSelectedSceneId(v.scenes?.[0]?.id || null);
              }}
              onKeyDown={() => {}}
              role="button"
              tabIndex={0}
            >
              <span
                className="h-5 w-5 shrink-0 rounded-full border border-border"
                style={{ background: v.colorHex }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  {v.name}{" "}
                  {v.isPrimary ? (
                    <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Primary
                    </span>
                  ) : null}
                </div>
                <div className="text-[11px] text-muted">
                  {v.scenes?.length || 0} scene
                  {(v.scenes?.length || 0) !== 1 ? "s" : ""}
                </div>
              </div>
              {!v.isPrimary ? (
                <button
                  type="button"
                  title="Set as primary color"
                  onClick={(e) => {
                    e.stopPropagation();
                    void submit("set_primary_variant", { id: v.id });
                  }}
                  className="border-0 bg-transparent cursor-pointer"
                >
                  ★
                </button>
              ) : null}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void submit("delete_variant", { id: v.id });
                }}
                className="border-0 bg-transparent cursor-pointer text-danger"
              >
                🗑
              </button>
            </div>
          ))}

          <div className="mt-2 border-t border-border pt-3">
            <input
              placeholder="Variant name"
              value={newVariantName}
              onChange={(e) => setNewVariantName(e.target.value)}
              className="mb-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <input
                type="color"
                value={newVariantColor}
                onChange={(e) => setNewVariantColor(e.target.value)}
                className="h-9 w-11"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!newVariantName.trim()) return;
                  void submit("add_variant", {
                    name: newVariantName.trim(),
                    colorHex: newVariantColor,
                  });
                  setNewVariantName("");
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-background disabled:opacity-60"
              >
                + Add
              </button>
            </div>
          </div>
        </div>

        {/* Scenes */}
        <div className="rounded-xl border border-border bg-panel p-4">
          <h3 className="mb-1 text-base font-semibold">Scenes</h3>
          <p className="mb-3 text-xs text-muted">
            {selectedVariant?.name || "Select variant"}
          </p>

          {!selectedVariant ? (
            <p className="text-sm text-muted">Select a variant to view scenes.</p>
          ) : null}

          {scenes.map((s) => (
            <div
              key={s.id}
              className={`mb-1.5 flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 ${
                s.id === selectedSceneId
                  ? "border border-accent bg-accent/5"
                  : "border border-transparent hover:bg-background"
              }`}
              onClick={() => loadScene(s)}
              role="button"
              tabIndex={0}
              onKeyDown={() => {}}
            >
              <div className="flex-1">
                <div className="text-sm font-semibold">{s.name}</div>
                <div className="mt-1.5 flex gap-2 text-[11px]">
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1"
                  >
                    <input
                      type="checkbox"
                      checked={s.useLightImage}
                      disabled={busy}
                      onChange={(e) =>
                        toggleFlag(s, "useLightImage", e.target.checked)
                      }
                    />
                    Light
                  </label>
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1"
                  >
                    <input
                      type="checkbox"
                      checked={s.useDarkImage}
                      disabled={busy}
                      onChange={(e) =>
                        toggleFlag(s, "useDarkImage", e.target.checked)
                      }
                    />
                    Dark
                  </label>
                </div>
                {s.isPrimary ? (
                  <span className="text-[10px] text-accent">Primary scene</span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void submit("set_primary_scene", {
                        id: s.id,
                        variantId: s.variantId,
                      });
                    }}
                    className="mt-1 rounded-md border border-border bg-white px-2 py-0.5 text-[11px] cursor-pointer"
                  >
                    Set as primary
                  </button>
                )}
                {!s.imageUrl ? (
                  <div className="mt-1 text-[11px] text-warning">
                    ⚠ No mockup image yet
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void submit("delete_scene", { id: s.id });
                }}
                className="border-0 bg-transparent cursor-pointer text-danger"
              >
                🗑
              </button>
            </div>
          ))}

          {selectedVariant ? (
            <div className="mt-2 border-t border-border pt-3">
              <input
                placeholder="Scene name (Front, Lifestyle…)"
                value={newSceneName}
                onChange={(e) => setNewSceneName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newSceneName.trim()) {
                    void submit("add_scene", {
                      variantId: selectedVariant.id,
                      name: newSceneName.trim(),
                    });
                    setNewSceneName("");
                  }
                }}
                className="mb-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!newSceneName.trim()) return;
                  void submit("add_scene", {
                    variantId: selectedVariant.id,
                    name: newSceneName.trim(),
                  });
                  setNewSceneName("");
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-background disabled:opacity-60"
              >
                + Add scene
              </button>
            </div>
          ) : null}
        </div>

        {/* Canvas */}
        <div className="rounded-xl border border-border bg-panel p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 text-base font-semibold">
              Print area
              {selectedScene ? (
                <span className="text-sm font-normal text-muted">
                  {" "}
                  — {selectedVariant?.name} / {selectedScene.name}
                </span>
              ) : null}
            </h3>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={uploadImage}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedScene || busy}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-background disabled:opacity-50"
              >
                {busy ? "Processing…" : "Upload image"}
              </button>
              <button
                type="button"
                disabled={!selectedScene || busy}
                onClick={() =>
                  void submit("save_crop", {
                    id: selectedScene!.id,
                    cropX: Math.round(cropRegion.x),
                    cropY: Math.round(cropRegion.y),
                    cropW: Math.round(cropRegion.width),
                    cropH: Math.round(cropRegion.height),
                  })
                }
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                Save print area
              </button>
              <button
                type="button"
                disabled={!selectedVariant || busy}
                onClick={() => {
                  if (!selectedVariant || !selectedScene) return;
                  setStatusMsg("Syncing print area…");
                  void submit("sync_crop_scenes", {
                    scope: "template",
                    id: selectedScene.id,
                    variantId: selectedVariant.id,
                    cropX: Math.round(cropRegion.x),
                    cropY: Math.round(cropRegion.y),
                    cropW: Math.round(cropRegion.width),
                    cropH: Math.round(cropRegion.height),
                  });
                }}
                title="Copy the current print area to every scene and color in this template"
                className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Sync all scenes
              </button>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="block w-full max-w-[600px] rounded-lg border border-border"
            style={{ cursor: cursorStyle }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={() => setDragMode(null)}
            onMouseLeave={() => setDragMode(null)}
          />

          <div className="mt-3 grid grid-cols-4 gap-3">
            {(["x", "y", "width", "height"] as const).map((key) => (
              <label key={key} className="text-xs">
                {key.toUpperCase()}
                <input
                  type="number"
                  value={Math.round(cropRegion[key])}
                  onChange={(e) =>
                    setCropRegion((p) => ({
                      ...p,
                      [key]: Number(e.target.value),
                    }))
                  }
                  className="mt-1 block w-full rounded-lg border border-border bg-white px-2 py-2 text-sm"
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
