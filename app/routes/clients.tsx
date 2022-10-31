import {
  Form,
  Outlet,
  Link,
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";
import { useParams } from "react-router";
import { prisma } from "~/db.server";
import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { Client } from "@prisma/client";
import SearchHighlight, {
  SearchHighlightContext,
} from "~/components/SearchHighlight";
import InputQueryClients from "~/components/InputQueryClients";
import { getDataFromQuery } from "~/utils/queryParser";
import { includes } from "ramda";
import { useMemo } from "react";

type LoaderData = {
  clients: Client[];
};

export async function loader({ request }: LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() || "";

  const data = getDataFromQuery(query);

  const where =
    data.length !== 0
      ? {
          OR: data.map((item) => ({
            AND: Object.entries(item).flatMap(([key, value]) => {
              switch (key) {
                case "q":
                  return {
                    OR: [
                      { name: { contains: value } },
                      { title: { contains: value } },
                      { quote: { contains: value } },
                    ],
                  };
                case "name":
                  return { name: { contains: value } };
                case "quote":
                  return { quote: { contains: value } };
                case "title":
                  return { title: { contains: value } };
                default:
                  return {};
              }
            }),
          })),
        }
      : undefined;

  return json<LoaderData>({
    clients: await prisma.client.findMany({
      where,
      take: 10,
    }),
  });
}

function ClientItem({
  slug,
  name,
  avatar,
  title,
  quote,
}: {
  slug: string;
  name: string;
  avatar: string;
  title: string | null;
  quote?: string | null;
}) {
  const { clientSlug } = useParams();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim().toLowerCase() || "";

  const parsedQuery = useMemo(
    () =>
      getDataFromQuery(query)
        .map(Object.entries)
        .flat()
        .flatMap((pair: [string, string]) =>
          pair[0] === "q"
            ? [
                ["name", pair[1]],
                ["title", pair[1]],
                ["quote", pair[1]],
              ]
            : [pair]
        )
        .reduce<Record<string, string[]>>((acc, [key, value]) => {
          if (acc[key]) {
            acc[key].push(value);
          } else {
            acc[key] = [value];
          }
          return acc;
        }, {}),
    [query]
  );

  return (
    <Link
      to={`./${slug}?${searchParams}`}
      className={`flex items-center gap-2 p-1 ${
        clientSlug === slug ? "bg-gray-100" : ""
      }`}
    >
      <img
        className="h-8 w-8 rounded-full object-contain"
        src={avatar}
        alt=""
      />
      <div>
        <SearchHighlightContext.Provider value={parsedQuery.name || []}>
          <span className="text-indigo-600">
            <SearchHighlight text={name} />
          </span>
        </SearchHighlightContext.Provider>

        {title &&
          parsedQuery.title?.some((query: string) =>
            includes(query, title.toLowerCase())
          ) && (
            <SearchHighlightContext.Provider value={parsedQuery.title || []}>
              <dl className="flex gap-1 text-sm">
                <dt className="w-12 text-gray-400">title:</dt>
                <dd className="">
                  <SearchHighlight text={title} />
                </dd>
              </dl>
            </SearchHighlightContext.Provider>
          )}

        {quote &&
          parsedQuery.quote?.some((query: string) =>
            includes(query, quote.toLowerCase())
          ) && (
            <SearchHighlightContext.Provider value={parsedQuery.quote || []}>
              <dl className="flex gap-1 text-sm">
                <dt className="w-12 text-gray-400">quote:</dt>
                <dd>
                  <SearchHighlight text={quote} />
                </dd>
              </dl>
            </SearchHighlightContext.Provider>
          )}
      </div>
    </Link>
  );
}

export default function Clients() {
  const { clientSlug } = useParams();
  const { clients } = useLoaderData<LoaderData>();

  return (
    <main className="mx-auto flex max-w-[960px] justify-items-stretch gap-2 p-4">
      <Form
        action={clientSlug ? `/clients/${clientSlug}` : "/clients"}
        className="w-[400px]"
      >
        <div className="mb-4 flex">
          <InputQueryClients name="q" />
          <button
            className="
              relative
              right-1
              rounded-r-full
              border-2
              border-gray-500
              border-l-transparent
              px-3
              text-black
              focus:border-blue-500
              focus:ring-1
              focus:ring-blue-500
              focus:ring-offset-1
            "
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 14 14"
              className="h-5 w-5"
            >
              <g className="fill-none stroke-current stroke-1">
                <circle cx={9} cy={5} r={4.5} />
                <path d="M10.25,3.67a1.5,1.5,0,0,0-2.31-.23" fill="none" />
                <line x1={0.5} y1={13.5} x2={6.08} y2={8.43} />
              </g>
            </svg>
          </button>
        </div>

        {clients.length === 0 && (
          <div>No clients found try to change query</div>
        )}

        {clients.map(({ slug, name, avatar, title, quote }) => (
          <ClientItem
            key={slug}
            name={name}
            slug={slug}
            avatar={avatar}
            title={title}
            quote={quote}
          />
        ))}
      </Form>
      <div className="flex-1">
        <Outlet />
      </div>
    </main>
  );
}