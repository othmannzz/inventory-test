import { Suspense } from "react";
import { Await, useLoaderData, useFetcher, useRouteError, useRevalidator } from "react-router";
import type { Route } from "./+types/dashboard";
import { getInventory, claimStock } from "~/models/inventory.server";
import {
  Page,
  Card,
  DataTable,
  SkeletonBodyText,
  SkeletonDisplayText,
  Button,
  InlineStack,
  Text,
  Banner,
} from "@shopify/polaris";


export async function loader() {
  return {
    inventoryPromise: getInventory(),
  };
}


export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const itemId = formData.get("itemId") as string;
  
  try {
    const updatedItem = await claimStock(itemId);
    return { success: true, item: updatedItem };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to claim stock" 
    };
  }
}

export default function Dashboard() {
  const { inventoryPromise } = useLoaderData<typeof loader>();

  return (
    <Page title="Inventory Dashboard" subtitle="Real-time warehouse inventory">
      <Card>
        <Suspense fallback={<LoadingSkeleton />}>
          <Await resolve={inventoryPromise} errorElement={<InventoryErrorFallback />}>
            {(inventory) => <InventoryTable items={inventory} />}
          </Await>
        </Suspense>
      </Card>
    </Page>
  );
}


function InventoryErrorFallback({ error }: { error?: unknown }) {
  const revalidator = useRevalidator();
  

  const errorMessage = error instanceof Error ? error.message : "Failed to load inventory";
  
  return (
    <Banner
      tone="critical"
      title="Failed to load inventory"
      action={{
        content: "Retry",
        onAction: () => {
          revalidator.revalidate();
        },
        loading: revalidator.state === "loading",
      }}
    >
      <p>{errorMessage}</p>
    </Banner>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: "20px" }}>
      <SkeletonDisplayText size="medium" />
      <br />
      <SkeletonBodyText lines={5} />
    </div>
  );
}


function InventoryTable({ items }: { items: Awaited<ReturnType<typeof getInventory>> }) {
  const rows = items.map((item) => [
    item.name,
    <InventoryStockCell key={`stock-${item.id}`} item={item} />,
    <InventoryActionCell key={`action-${item.id}`} item={item} />,
  ]);

  return (
    <DataTable
      columnContentTypes={["text", "numeric", "text"]}
      headings={["Product Name", "Stock", "Action"]}
      rows={rows}
    />
  );
}


function InventoryStockCell({ item }: { item: { id: string; name: string; stock: number } }) {
  const fetcher = useFetcher<typeof action>({ key: `claim-${item.id}` });
  
 
  const isUpdating = fetcher.state === "submitting" || fetcher.state === "loading";
  

  const hasError = fetcher.data && !fetcher.data.success;
  
 
  let displayStock = item.stock;
  

  if (isUpdating && !hasError) {
    displayStock = Math.max(0, item.stock - 1);
  }
  
  
  
  return (
    <InlineStack gap="200" align="center">
      <Text as="span" variant="bodyMd" fontWeight="semibold">
        {displayStock}
      </Text>

      {hasError && fetcher.data && (
        <Text as="span" variant="bodySm" tone="critical">
          {fetcher.data.error}
        </Text>
      )}
    </InlineStack>
  );
}


function InventoryActionCell({ item }: { item: { id: string; name: string; stock: number } }) {
  const fetcher = useFetcher({ key: `claim-${item.id}` });
  
 
  const isSubmitting = fetcher.state === "submitting" || fetcher.state === "loading";
  
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="itemId" value={item.id} />
      <Button 
        size="slim" 
        submit
        loading={isSubmitting}
        disabled={isSubmitting || item.stock === 0}
      >
        Claim One
      </Button>
    </fetcher.Form>
  );
}

// TASK 3: Route-Level ErrorBoundary 
export function ErrorBoundary() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  
  const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
  
  return (
    <Page title="Inventory Dashboard" subtitle="Real-time warehouse inventory">
      <Card>
        <Banner
          tone="critical"
          title="Failed to load inventory"
          action={{
            content: "Retry",
            onAction: () => {
              revalidator.revalidate();
            },
            loading: revalidator.state === "loading",
          }}
        >
          <p>{errorMessage}</p>
        </Banner>
      </Card>
    </Page>
  );
}