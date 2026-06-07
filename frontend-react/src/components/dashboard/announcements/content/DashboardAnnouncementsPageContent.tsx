"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Image as AntdImage } from "antd";
import { CalendarDays, ChevronDown, Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui";
import {
  useInfiniteAnnouncements,
  type Announcement,
} from "@/hooks/information/announcements";
import { formatDateTimeWib } from "@/lib/date";
import { stripHtmlTags } from "@/lib/text";

function renderAnnouncementNode(node: ChildNode, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as HTMLElement;
  const children = Array.from(element.childNodes).map((child, index) =>
    renderAnnouncementNode(child, `${key}-${index}`),
  );

  if (element.tagName.toLowerCase() === "img") {
    const src = element.getAttribute("src") || "";
    if (!src) return null;

    return (
      <AntdImage
        key={key}
        src={src}
        alt={element.getAttribute("alt") || "Gambar pengumuman"}
        className="rounded-xl"
      />
    );
  }

  const props: Record<string, unknown> = { key };
  const className = element.getAttribute("class");
  if (className) {
    props.className = className;
  }

  if (element.tagName.toLowerCase() === "a") {
    const href = element.getAttribute("href");
    if (href) props.href = href;
    const target = element.getAttribute("target");
    if (target) props.target = target;
    const rel = element.getAttribute("rel");
    if (rel) props.rel = rel;
  }

  return React.createElement(element.tagName.toLowerCase(), props, ...children);
}

function renderAnnouncementContent(content: string): ReactNode {
  if (typeof window === "undefined") {
    return content;
  }

  const document = new DOMParser().parseFromString(content, "text/html");
  return Array.from(document.body.childNodes).map((node, index) =>
    renderAnnouncementNode(node, `announcement-node-${index}`),
  );
}

function AnnouncementCard({
  announcement,
  defaultOpen = false,
}: {
  announcement: Announcement;
  defaultOpen?: boolean;
}) {
  const plainContent = stripHtmlTags(announcement.content || "");
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const content = useMemo(
    () => renderAnnouncementContent(announcement.content || ""),
    [announcement.content],
  );

  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen, announcement.id]);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50"
        aria-expanded={isOpen}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDateTimeWib(announcement.created_at)}
            </span>
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-900">
            {announcement.title || "Pengumuman"}
          </h3>
        </div>
        <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${
              isOpen ? "rotate-180" : "rotate-0"
            }`}
          />
        </span>
      </button>
      {isOpen ? (
        <div className="border-t border-slate-200 px-5 py-4">
          {plainContent ? (
            <div className="announcement-rich-text-content break-words text-sm text-slate-700">
              {content}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-slate-700">-</p>
          )}
        </div>
      ) : null}
    </article>
  );
}

function AnnouncementSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-3 w-36" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      </div>
    </div>
  );
}

export default function DashboardAnnouncementsPage() {
  const [search] = useState("");
  const { announcements, isLoading, isFetchingMore, hasMore, error, loadMore } =
    useInfiniteAnnouncements();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const filteredAnnouncements = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sorted = [...announcements].sort((first, second) => {
      const firstTime = first.created_at
        ? new Date(first.created_at).getTime()
        : 0;
      const secondTime = second.created_at
        ? new Date(second.created_at).getTime()
        : 0;
      return secondTime - firstTime;
    });

    if (!query) return sorted;

    return sorted.filter((item) =>
      [item.title, stripHtmlTags(item.content || "")]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [announcements, search]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          void loadMore();
        }
      },
      {
        rootMargin: "160px 0px",
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadMore]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <AnnouncementSkeleton key={`announcement-skeleton-${index}`} />
        ))}
      </div>
    );
  }

  if (error && !filteredAnnouncements.length) {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="space-y-3">
        {filteredAnnouncements.length ? (
          filteredAnnouncements.map((announcement, index) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              defaultOpen={index === 0}
            />
          ))
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            Belum ada pengumuman yang tersedia.
          </div>
        )}
      </div>

      {error && filteredAnnouncements.length ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {hasMore ? (
        <div ref={sentinelRef} className="flex min-h-12 items-center justify-center">
          {isFetchingMore ? (
            <div className="inline-flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat pengumuman berikutnya...
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
