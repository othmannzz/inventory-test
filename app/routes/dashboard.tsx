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

// TASK 1: Return promise directly for streaming (React Router v7)
export async function loader() {
  return {
    inventoryPromise: getInventory(),
  };
}

// TASK 2: Action handler for claiming stock
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

// TASK 3: Error fallback component for Await errors (contained within Card)
function InventoryErrorFallback({ error }: { error?: unknown }) {
  const revalidator = useRevalidator();
  
  // Error is passed as a prop from Await's errorElement
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

// TASK 2: Updated InventoryTable with Optimistic UI
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

// TASK 2: Stock cell with optimistic updates
function InventoryStockCell({ item }: { item: { id: string; name: string; stock: number } }) {
  const fetcher = useFetcher<typeof action>({ key: `claim-${item.id}` });
  
  // Check if this fetcher is active (submitting or loading)
  const isUpdating = fetcher.state === "submitting" || fetcher.state === "loading";
  
  // Check if there's an error
  const hasError = fetcher.data && !fetcher.data.success;
  
  // Requirement 1: Optimistic update - decrease stock instantly when submitting
  // Requirement 2: Rollback - if there's an error, show original stock (don't apply optimistic update)
  let displayStock = item.stock;
  
  // Apply optimistic update during submitting OR loading state (before error is known)
  if (isUpdating && !hasError) {
    displayStock = Math.max(0, item.stock - 1);
  }
  
  // If server returned success, React Router will revalidate and update item.stock automatically
  
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

// TASK 2: Action cell with form and loading protection
function InventoryActionCell({ item }: { item: { id: string; name: string; stock: number } }) {
  const fetcher = useFetcher({ key: `claim-${item.id}` });
  
  // Check if THIS specific item is being submitted
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

// TASK 3: Route-Level ErrorBoundary - keeps Page structure visible, only Card shows error
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