---
name: GKT Ticketing UI Styleguide & Rules
description: Enforces strict layout, theme, and authentication rules across all Next.js platform pages.
---

# Global Application Rules (GKT Ticketing System)

**CRITICAL INSTRUCTION**: You must adhere to these rules when building ANY page or component in the `gkt-frontend` directory.

## 1. Role-Based Authentication
- **NEVER** expose data without verifying the user's role.
- Assume the user's role is stored in a JWT token or React Context. 
- Component rendering: Use checks like `if (user.role !== 'super_admin') return <Unauthorized />` early in the component or via middleware.

## 2. Global Layout Structure
Every inner application page (excluding public landing pages) must follow this core flexbox structure to maintain layout muscle memory:
- **Left**: Collapsible Sidebar Navigation
- **Top**: Sticky Header (contains Breadcrumbs, Search, Theme Toggle, User Profile)
- **Center/Main**: The scrollable content area `main { flex: 1, padding: 24px }`
- **Max Width**: Keep core reading/table content constrained or clearly padded (do not let tables bleed infinitely to the edges on ultrawide monitors).

## 3. Theming (Light & Dark Mode)
The application must strictly support both Light and Dark themes. The themes are inspired by the Apollo.io aesthetics (clean whites, stark contrasts, vibrant accent yellows/greens, deep blacks for dark mode).

### Light Theme (Default)
- **Background**: `#FFFFFF` (Pure white) or extremely light gray `#F8F9FA` for app backgrounds.
- **Surface/Card**: `#FFFFFF` with very subtle borders `1px solid #E5E7EB` and soft shadows `box-shadow: 0 1px 3px rgba(0,0,0,0.05)`.
- **Text (Primary)**: `#111827` (Near black for high readability)
- **Text (Secondary)**: `#4B5563` (Muted gray)
- **Accent/Brand**: `#FACC15` (Vibrant Apollo Yellow) paired with stark black text over the yellow for buttons.
- **Accents**: Subtle gradients (like the gold/yellow linear background seen in the reference) for hero/promo sections. `background: linear-gradient(135deg, #eab308, #ca8a04)`

### Dark Theme
- **Background**: `#0F172A` (Slate deep blue/black)
- **Surface/Card**: `#1E293B` (Slightly lighter slate) or `rgba(255, 255, 255, 0.03)` with `1px solid rgba(255, 255, 255, 0.1)`.
- **Text (Primary)**: `#F8FAFC` (Off-white)
- **Text (Secondary)**: `#94A3B8` (Muted slate)
- **Accent/Brand**: `#FACC15` (Yellow pops beautifully against the dark slate).
- **Accents**: Gradients shift to darker, richer metallic tones.

*Ensure that text contrast ratios are always accessible. Use `next-themes` and CSS variables or explicit React inline ternary logic based on `{ theme === 'dark' }`.*

## 4. UI Components & Elements
- **Forms & Inputs**: Minimalist. 12px border radius. Gray borders `1px solid #d1d5db` (light) or `rgba(255,255,255,0.1)` (dark).
- **Buttons**:
  - Primary (Yellow): `background: #FACC15`, `color: #000000`, `border-radius: 8px`, `font-weight: 600`.
  - Secondary/Outline: Transparent background with stark borders matching the primary text color.
- **Tables**: `border-collapse: collapse`. Headers must have slightly distinct backgrounds (e.g., `#F9FAFB` light / `#1E293B` dark) and bold, muted text.

## 5. Application Feature Requirements
When creating flows, ensure the UI accounts for:
- Breadcrumbs / Clear page titles.
- Action areas (e.g., "Export", "Create New", "Filter" buttons always top right of content).
- Empty States: Never leave a page blank. If a table has no data, show an illustration and a "Create your first X" call to action.
- Status Badges: Distinct colors for statuses (Green = Active/Paid/Resolved, Yellow = Pending/Warning, Red = Error/Revoked, Gray = Draft).

## 6. Data Fetching & State Management
- **NO HARDCODED DATA**: Never hardcode mock data arrays directly in the UI components (e.g., `const users = [{ name: 'Test' }]`). 
- All data must be fetched from the backend API, or if the API doesn't exist yet, it should be managed via empty robust React state objects that are explicitly awaiting backend wiring.
- Always include `isLoading` states (spinners or skeletons) for async data fetching.
