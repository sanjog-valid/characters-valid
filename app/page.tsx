"use client";

import {
  AlertCircle,
  Copy,
  Database,
  Download,
  ImagePlus,
  Loader2,
  RefreshCw,
  Search,
  UploadCloud,
  X
} from "lucide-react";
import { type DragEvent, useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CharacterRecord, CharacterStatus } from "@/lib/types";

type UploadItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: "queued" | "uploading" | "done" | "failed";
};

type ViewMode = "library" | "upload";

const statusOptions: Array<CharacterStatus | "all"> = ["all", "ready", "processing", "failed", "queued"];

export default function Home() {
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [selected, setSelected] = useState<CharacterRecord | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CharacterStatus | "all">("all");
  const [activeView, setActiveView] = useState<ViewMode>("library");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const runSearch = useCallback(async () => {
    setSearching(true);
    setError("");

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query,
          status: statusFilter
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Search failed.");
      }

      setCharacters(payload.characters);
      setSelected((current) => {
        if (!current) {
          return payload.characters[0] || null;
        }

        return payload.characters.find((character: CharacterRecord) => character.id === current.id) || payload.characters[0] || null;
      });
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed.");
    } finally {
      setSearching(false);
      setLoading(false);
    }
  }, [query, statusFilter]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      runSearch();
    }, 350);

    return () => window.clearTimeout(handle);
  }, [runSearch]);

  return (
    <main className="grid min-h-screen grid-cols-[232px_minmax(0,1fr)] bg-background text-foreground max-lg:grid-cols-1">
      <aside className="flex flex-col gap-7 border-r bg-card px-4 py-6 max-lg:border-r-0 max-lg:border-b" aria-label="Primary">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-md bg-primary text-sm font-extrabold text-primary-foreground">V</div>
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-bold uppercase leading-none text-muted-foreground">Valid.co</p>
            <h1 className="text-[17px] font-semibold leading-tight">Character Library</h1>
          </div>
        </div>

        <nav className="grid gap-1 max-lg:grid-cols-2 max-sm:grid-cols-1">
          <Button
            variant={activeView === "library" ? "secondary" : "ghost"}
            className={cn("justify-start", activeView === "library" && "border border-border")}
            type="button"
            onClick={() => setActiveView("library")}
          >
            <Database />
            Library
          </Button>
          <Button
            variant={activeView === "upload" ? "secondary" : "ghost"}
            className={cn("justify-start", activeView === "upload" && "border border-border")}
            type="button"
            onClick={() => setActiveView("upload")}
          >
            <UploadCloud />
            Upload
          </Button>
        </nav>
      </aside>

      <section className="min-w-0">
        <header className="sticky top-0 z-10 grid min-h-[78px] grid-cols-[minmax(320px,1fr)_auto] items-center gap-3 border-b bg-card/90 px-6 py-4 backdrop-blur-xl max-md:grid-cols-1 max-sm:px-4">
          {activeView === "library" ? (
            <>
              <PageHeading
                eyebrow="Library"
                title="Character Library"
                description={loading ? "Loading reusable references" : `${characters.length} matching character${characters.length === 1 ? "" : "s"}`}
              />

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" type="button" onClick={runSearch}>
                  <RefreshCw className={cn(searching && "spin")} />
                  Refresh
                </Button>
              </div>
            </>
          ) : (
            <>
              <PageHeading eyebrow="Upload" title="Batch character intake" description="Drop one reference or a full batch. Analysis starts after upload." />
            </>
          )}
        </header>

        {error ? (
          <Alert variant="destructive" className="mx-6 mt-4 max-sm:mx-4">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <section
          className={cn("w-full max-w-[1220px] px-6 py-4 max-sm:px-4", activeView !== "upload" && "hidden")}
          aria-hidden={activeView !== "upload"}
        >
            <UploadWorkbench onUploaded={runSearch} />
        </section>

        <div
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_400px] items-start gap-4 px-6 py-4 max-xl:grid-cols-1 max-sm:px-4",
            activeView !== "library" && "hidden"
          )}
          aria-hidden={activeView !== "library"}
        >
            <section className="grid min-w-0 gap-5">
              <Card>
                <CardContent className="grid grid-cols-[minmax(280px,1fr)_156px] gap-2 p-2 max-md:grid-cols-1">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9 pr-9"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="50 year old man black shirt"
                      aria-label="Search characters"
                    />
                    {searching ? <Loader2 className="spin absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /> : null}
                  </div>

                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as CharacterStatus | "all")}>
                    <SelectTrigger aria-label="Status filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status === "all" ? "All statuses" : titleCase(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <CharacterGrid characters={characters} selectedId={selected?.id} onSelect={setSelected} loading={loading} />
            </section>

            <CharacterDrawer character={selected} />
          </div>
      </section>
    </main>
  );
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-bold uppercase leading-none text-muted-foreground">{eyebrow}</p>
      <h2 className="text-[22px] font-semibold leading-tight">{title}</h2>
      <span className="mt-1 block text-sm leading-snug text-muted-foreground">{description}</span>
    </div>
  );
}

function UploadWorkbench({ onUploaded }: { onUploaded: () => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const addFiles = useCallback((files: FileList | File[]) => {
    const nextItems = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "queued" as const
      }));

    if (!nextItems.length) {
      setError("Drop image files only.");
      return;
    }

    setError("");
    setItems((current) => [...current, ...nextItems]);
  }, []);

  function handleDragEnter(event: DragEvent<HTMLLabelElement>) {
    if (!hasDraggedFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    if (!hasDraggedFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = uploading ? "none" : "copy";
    setDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    if (!hasDraggedFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    if (dragDepthRef.current === 0) {
      setDragActive(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setDragActive(false);

    if (!uploading) {
      addFiles(event.dataTransfer.files);
    }
  }

  async function upload() {
    if (!items.length || uploading) {
      return;
    }

    setUploading(true);
    setError("");
    setItems((current) => current.map((item) => ({ ...item, status: "uploading" })));

    const formData = new FormData();

    items.forEach((item) => {
      formData.append("files", item.file, item.file.name);
    });

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Upload failed.");
      }

      setItems((current) => current.map((item) => ({ ...item, status: "done" })));
      await onUploaded();
      setTimeout(() => {
        setItems((current) => {
          current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
          return [];
        });
      }, 500);
    } catch (uploadError) {
      setItems((current) => current.map((item) => ({ ...item, status: "failed" })));
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase leading-none text-muted-foreground">Batch Intake</p>
          <CardTitle className="text-lg">Upload character references</CardTitle>
          <CardDescription>{items.length ? `${items.length} file${items.length === 1 ? "" : "s"} queued` : "Drop images here when they are ready for analysis."}</CardDescription>
        </div>

        <CardAction>
          <Button type="button" onClick={upload} disabled={!items.length || uploading}>
            {uploading ? <Loader2 className="spin" /> : <UploadCloud />}
            Upload
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="grid gap-4">
        <Button
          asChild
          variant="ghost"
          className={cn(
            "h-auto min-h-[168px] w-full cursor-pointer border border-dashed border-input bg-muted text-sm font-semibold text-muted-foreground",
            "hover:border-primary hover:bg-accent hover:text-accent-foreground",
            dragActive && "border-primary bg-accent text-accent-foreground shadow-[inset_0_0_0_1px_rgba(15,118,110,0.18),0_0_0_3px_rgba(15,118,110,0.08)]",
            uploading && "pointer-events-none opacity-60"
          )}
        >
          <label
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={(event) => {
              if (uploading) {
                event.preventDefault();
              }
            }}
            onKeyDown={(event) => {
              if (!uploading && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
            aria-disabled={uploading}
          >
            <ImagePlus className="size-5" />
            <span>{dragActive ? "Release to add images" : "Drop images or choose files"}</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              hidden
              onChange={(event) => {
                if (event.target.files) {
                  addFiles(event.target.files);
                  event.target.value = "";
                }
              }}
            />
          </label>
        </Button>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {items.length ? (
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader className="max-sm:hidden">
                <TableRow>
                  <TableHead className="w-[52px]" />
                  <TableHead>File</TableHead>
                  <TableHead className="w-[118px]">Status</TableHead>
                  <TableHead className="w-9" />
                </TableRow>
              </TableHeader>
              <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="max-sm:grid max-sm:grid-cols-[52px_minmax(0,1fr)_36px] max-sm:items-center">
                  <TableCell className="w-[52px]">
                    <img className="size-[52px] rounded-md object-cover" src={item.previewUrl} alt="" />
                  </TableCell>
                  <TableCell className="min-w-0">
                    <div className="grid min-w-0 gap-1">
                      <strong className="block truncate text-sm font-semibold leading-tight">{item.file.name}</strong>
                      <span className="block text-xs leading-none text-muted-foreground">{formatBytes(item.file.size)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="w-[118px] max-sm:col-start-2 max-sm:col-end-4 max-sm:w-auto">
                    <div className="grid gap-1.5">
                    <StatusPill status={item.status} />
                    <span className="h-1 overflow-hidden rounded-full bg-border">
                      <span className={cn("block h-full rounded-full", progressTone(item.status))} style={{ width: progressWidth(item.status) }} />
                    </span>
                    </div>
                  </TableCell>
                  <TableCell className="w-9">
                  <Button
                    variant="outline"
                    size="icon"
                    type="button"
                    aria-label="Remove image"
                    onClick={() => {
                      URL.revokeObjectURL(item.previewUrl);
                      setItems((current) => current.filter((row) => row.id !== item.id));
                    }}
                  >
                    <X />
                  </Button>
                  </TableCell>
                </TableRow>
              ))}
              </TableBody>
            </Table>
          </Card>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CharacterGrid({
  characters,
  selectedId,
  onSelect,
  loading
}: {
  characters: CharacterRecord[];
  selectedId?: string;
  onSelect: (character: CharacterRecord) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card className="grid min-h-[220px] gap-3 p-4">
        <Skeleton className="h-5 w-44" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(188px,1fr))] gap-3">
          <Skeleton className="aspect-[4/5] rounded-lg" />
          <Skeleton className="aspect-[4/5] rounded-lg" />
          <Skeleton className="aspect-[4/5] rounded-lg" />
        </div>
      </Card>
    );
  }

  if (!characters.length) {
    return <Card className="grid min-h-[220px] place-items-center text-sm font-semibold text-muted-foreground">No matching characters.</Card>;
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(188px,1fr))] gap-3 max-sm:grid-cols-1">
      {characters.map((character) => (
        <Button
          variant="ghost"
          className={cn(
            "h-auto flex-col items-stretch justify-start gap-0 overflow-hidden rounded-lg border bg-card p-0 text-left shadow-xs transition-colors hover:bg-muted",
            selectedId === character.id && "border-primary ring-2 ring-primary/20"
          )}
          key={character.id}
          type="button"
          onClick={() => onSelect(character)}
        >
          <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
            <img className="size-full object-cover" src={character.image_url} alt={character.profile.summary || character.file_name} />
            <StatusBadge status={character.status} />
            <div className="absolute inset-x-2 bottom-2 flex min-h-7 items-center justify-between gap-2 rounded-md border bg-card/90 px-2 py-1 text-xs font-semibold">
              <span className="truncate">{character.client_name}</span>
              {typeof character.similarity === "number" ? <strong className="text-primary">{Math.round(character.similarity * 100)}%</strong> : null}
            </div>
          </div>
          <div className="grid gap-2 p-2.5">
            <div className="grid gap-0.5">
              <strong className="line-clamp-2 text-sm font-semibold leading-snug">{character.profile.summary}</strong>
              <span className="text-xs text-muted-foreground">{character.profile.shot_type}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {profileChips(character).map((chip) => (
                <Badge variant="outline" className="max-w-full overflow-hidden text-ellipsis text-muted-foreground" key={chip}>
                  {chip}
                </Badge>
              ))}
            </div>
          </div>
        </Button>
      ))}
    </div>
  );
}

function CharacterDrawer({ character }: { character: CharacterRecord | null }) {
  const profile = character?.profile;

  if (!character || !profile) {
    return (
      <Card className="sticky top-[92px] grid min-h-[calc(100vh-120px)] place-items-center text-sm font-semibold text-muted-foreground max-xl:static max-xl:min-h-40">
        <div className="grid place-items-center gap-2">
          <ImagePlus className="size-6" />
          <span>Select a character.</span>
        </div>
      </Card>
    );
  }

  async function copyImageUrl() {
    if (character?.image_url) {
      await navigator.clipboard.writeText(character.image_url);
    }
  }

  return (
    <Card className="sticky top-[92px] overflow-hidden max-xl:static">
      <div className="relative aspect-[4/4.7] bg-secondary">
        <img className="size-full object-cover" src={character.image_url} alt={profile.summary} />
        <StatusBadge status={character.status} />
      </div>

      <CardHeader>
        <p className="text-[11px] font-bold uppercase leading-none text-muted-foreground">{character.client_name}</p>
        <CardTitle className="text-[17px] leading-snug">{profile.summary}</CardTitle>
        <CardDescription className="break-words">{character.file_name}</CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href={character.image_url} download={character.file_name}>
              <Download />
              Download reference
            </a>
          </Button>
          <Button variant="outline" type="button" onClick={copyImageUrl}>
            <Copy />
            Copy reference
          </Button>
        </div>

        <Table>
          <TableBody>
            <Attribute label="Age range" value={profile.apparent_age_range} />
            <Attribute label="Presentation" value={profile.gender_presentation} />
            <Attribute label="Wardrobe" value={profile.wardrobe.join(", ") || "unknown"} />
            <Attribute label="Colors" value={profile.dominant_colors.join(", ") || "unknown"} />
            <Attribute label="Expression" value={profile.expression} />
            <Attribute label="Pose" value={profile.pose} />
            <Attribute label="Shot" value={profile.shot_type} />
            <Attribute label="Background" value={profile.background} />
            <Attribute label="Style" value={profile.style} />
            <Attribute label="Quality" value={profile.quality_notes} />
          </TableBody>
        </Table>

        <div>
          <p className="mb-2 text-xs font-bold text-muted-foreground">Search phrases</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.searchable_phrases.map((phrase) => (
              <Badge variant="outline" className="max-w-full overflow-hidden text-ellipsis text-muted-foreground" key={phrase}>
                {phrase}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Attribute({ label, value }: { label: string; value: string }) {
  return (
    <TableRow>
      <TableCell className="w-28 align-top text-xs font-semibold text-muted-foreground">{label}</TableCell>
      <TableCell className="break-words whitespace-normal align-top text-sm leading-snug">{value}</TableCell>
    </TableRow>
  );
}

function StatusBadge({ status }: { status: CharacterStatus }) {
  return (
    <Badge variant="outline" className={cn("absolute left-2 top-2 capitalize", statusTone(status))}>
      {status}
    </Badge>
  );
}

function StatusPill({ status }: { status: UploadItem["status"] }) {
  return (
    <Badge variant="outline" className={cn("justify-center capitalize", statusTone(status))}>
      {status}
    </Badge>
  );
}

function profileChips(character: CharacterRecord) {
  return [
    character.profile.apparent_age_range,
    character.profile.gender_presentation,
    character.profile.wardrobe[0],
    character.profile.dominant_colors[0]
  ].filter(Boolean);
}

function statusTone(status: CharacterStatus | UploadItem["status"]) {
  if (status === "ready" || status === "done") {
    return "border-success/20 bg-success/10 text-success";
  }

  if (status === "failed") {
    return "border-destructive/20 bg-destructive/10 text-destructive";
  }

  return "border-warning/20 bg-warning/10 text-warning";
}

function progressTone(status: UploadItem["status"]) {
  if (status === "done") {
    return "bg-success";
  }

  if (status === "failed") {
    return "bg-destructive";
  }

  if (status === "uploading") {
    return "bg-info";
  }

  return "bg-warning";
}

function progressWidth(status: UploadItem["status"]) {
  if (status === "done" || status === "failed") {
    return "100%";
  }

  if (status === "uploading") {
    return "62%";
  }

  return "20%";
}

function titleCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function hasDraggedFiles(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types).includes("Files");
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
