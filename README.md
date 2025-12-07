# Inventory Dashboard - Remix Resilience Assessment

A warehouse inventory management system built with React Router and Shopify Polaris, demonstrating advanced patterns for handling unreliable APIs.

## Project Overview

This project showcases React Router-specific architectural patterns to build a resilient, performant application that feels instant despite working with a slow, unreliable backend API.

**Key Challenges Addressed:**
- 3-second API latency
- 20% random failure rate
- Slow mutations (1 second delay)

## Tech Stack

- **Framework**: React Router
- **UI Library**: Shopify Polaris
- **Language**: TypeScript
- **Runtime**: Node.js

## Getting Started

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Installation

Install the dependencies:

```bash
npm install
```

### Development

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173/dashboard`.

### Building for Production

Create a production build:

```bash
npm run build
```

## Implementation Details

### Task 1: Streaming & Performance (Eliminate the "White Screen")

**Problem**: Waiting for the 3-second `getInventory()` call creates a blank screen.

**Solution**: Used React Router's `defer()` and `<Await>` pattern for streaming data.

**Key Implementation:**
```typescript
export async function loader() {
  return defer({
    inventoryPromise: getInventory(), // Don't await!
  });
}

// In component
<Suspense fallback={<LoadingSkeleton />}>
  <Await resolve={inventoryPromise}>
    {(inventory) => <InventoryTable items={inventory} />}
  </Await>
</Suspense>
```

**Benefits:**
- Page shell renders immediately (0ms)
- Skeleton UI shows while data loads
- Better perceived performance

---

### Task 2: Optimistic UI & Race Conditions (Instant Feedback)

**Problem**: The 1-second `claimStock()` mutation creates poor UX with delayed feedback.

**Solution**: Implemented optimistic updates using `useFetcher` with automatic rollback.

**Key Implementation Choices:**

#### 1. Optimistic State Calculation
```typescript
const fetcher = useFetcher<typeof action>();
let displayStock = item.stock;

// Show optimistic value immediately when submitting
if (fetcher.formData?.get("itemId") === item.id) {
  displayStock = item.stock - 1;
}
```

**Why this works:**
- `fetcher.formData` is available immediately upon submission
- We can calculate the expected result before the server responds
- This creates instant visual feedback (0ms delay)

#### 2. Automatic Rollback Mechanism
```typescript
export async function action({ request }) {
  try {
    await claimStock(itemId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

**Why this works:**
- React Router automatically revalidates loaders after actions
- Fresh data from the loader overwrites optimistic values
- If action fails, the revalidation restores the correct stock count
- No manual state management needed

#### 3. Race Condition Protection
```typescript
const isSubmitting = fetcher.state === "submitting" && 
                     fetcher.formData?.get("itemId") === item.id;

<Button 
  loading={isSubmitting}
  disabled={isSubmitting || item.stock === 0}
  submit
>
```

**Why this works:**
- Checks both fetcher state AND specific item ID
- Prevents double-submissions during the 1-second delay
- Visual feedback (loading spinner) communicates pending state

**Alternative Approaches Avoided:**
- Using `useState()` - Would require manual state management and lose progressive enhancement
- Using `onClick` + `fetch()` - Would break without JavaScript and require manual form handling
- Component-level optimistic state - Would not integrate with React Router's revalidation system

---

### Task 3: Error Boundaries & Retry Logic (Contain the Blast)

**Problem**: The 20% random API failures crash the entire page.

**Solution**: Implemented route-level ErrorBoundary with retry functionality.

**Key Implementation Choices:**

#### 1. Route-Level Error Containment
```typescript
export function ErrorBoundary() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  
  return (
    <Page title="Inventory Dashboard">
      <Banner
        title="Error Loading Inventory"
        tone="critical"
        action={{
          content: 'Retry',
          onAction: () => revalidator.revalidate()
        }}
      >
        {isRouteErrorResponse(error) 
          ? error.statusText 
          : error.message}
      </Banner>
    </Page>
  );
}
```

**Why this works:**
- Exported from route file, not wrapped in components
- Only the inventory section fails, page structure remains
- Error stays contained to the `/dashboard` route

#### 2. Retry Logic Without Page Refresh
```typescript
const revalidator = useRevalidator();

<Button onClick={() => revalidator.revalidate()}>
  Retry
</Button>
```

**Why this works:**
- `useRevalidator()` re-runs the loader without navigation
- Maintains single-page app experience
- User can retry without losing context

#### 3. User Feedback with Polaris
- Used Polaris `Banner` component for error display
- Shows clear error message from the API
- Provides actionable "Retry" button
- Maintains consistent design system

**Alternative Approaches Avoided:**
- Try/catch in components - Would not catch loader errors
- Full page refresh - Poor UX, loses application state
- Generic error pages - Would lose page context and navigation

---

## React Router Patterns Demonstrated

| Pattern | Usage | Benefit |
|---------|-------|---------|
| `defer()` | Stream data to client | Immediate page render |
| `<Suspense>` + `<Await>` | Handle deferred promises | Progressive loading |
| `useFetcher()` | Non-navigating mutations | Optimistic UI updates |
| `fetcher.Form` | Progressive enhancement | Works without JS |
| `ErrorBoundary` | Route-level error handling | Graceful error recovery |
| `useRevalidator()` | Manual revalidation | Retry without refresh |

## Anti-Patterns Avoided

- No `useEffect()` for data fetching
- No `useState()` for server state
- No `onClick` + manual `fetch()` calls
- No component-level try/catch for loader errors
- No custom HTML elements (all Polaris components)

## Testing the Implementation

### Test Streaming (Task 1)
1. Navigate to `/dashboard`
2. Observe: Page header appears immediately
3. Observe: Skeleton shows for 3 seconds
4. Observe: Table populates with data

### Test Optimistic UI (Task 2)
1. Click "Claim One" on any item
2. Observe: Stock decreases immediately (0ms)
3. Observe: Button shows loading spinner
4. After 1 second: Stock updates with server response

### Test Error Rollback (Task 2)
1. Click "Claim One" on item with 0 stock
2. Observe: Optimistic update happens
3. Observe: Error message appears
4. Observe: Stock count reverts automatically

### Test Error Boundary (Task 3)
1. Refresh page until 20% failure occurs
2. Observe: Page structure remains intact
3. Observe: Error banner appears with message
4. Click "Retry" button
5. Observe: Loader re-runs without page refresh

## Project Structure

```
inventory-test/
├── app/
│   ├── models/
│   │   └── inventory.server.ts    # Mock backend API
│   ├── routes/
│   │   ├── dashboard.tsx          # Main dashboard route
│   │   └── home.tsx               # Landing page
│   └── root.tsx                   # App shell with Polaris
├── package.json
└── README.md
```

## Key Learnings

1. **Streaming over Waiting**: Never block UI on slow data fetches
2. **Optimistic UI**: Predict success and rollback on failure
3. **Error Boundaries**: Contain failures to preserve app stability
4. **Progressive Enhancement**: Forms work without JavaScript
5. **Design Systems**: Consistent UI with component libraries

## Deployment

### Docker Deployment

To build and run using Docker:

```bash
docker build -t inventory-dashboard .

# Run the container
docker run -p 3000:3000 inventory-dashboard
```

The containerized application can be deployed to any platform that supports Docker, including AWS ECS, Google Cloud Run, Azure Container Apps, Digital Ocean App Platform, Fly.io, and Railway.

### DIY Deployment

If you're familiar with deploying Node applications, the built-in app server is production-ready.

Make sure to deploy the output of `npm run build`

```
├── package.json
├── package-lock.json
├── build/
│   ├── client/    # Static assets
│   └── server/    # Server-side code
```

---

Built with React Router and Shopify Polaris.