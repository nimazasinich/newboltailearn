# Modern React + TypeScript UI Components

This project includes two main components built with React 18+ and TypeScript:

## Components

### 1. Loading.tsx
- **Location**: `src/components/Loading.tsx`
- **Features**:
  - Full-screen loading animation using Framer Motion
  - Smooth rotating gradient circle with inner logo
  - Animated background with floating elements
  - Progressive loading bar
  - Auto-transition after 2.5 seconds
  - Responsive design with Persian font support

### 2. Dashboard.tsx
- **Location**: `src/components/Dashboard.tsx`
- **Features**:
  - Fully functional dashboard with collapsible sidebar
  - Interactive navigation (Home, Reports, Settings)
  - Top navbar with search, notifications, and user avatar
  - Statistics cards with hover animations
  - Interactive charts using Recharts (Line chart, Pie chart)
  - Responsive data table with action buttons
  - Modern TailwindCSS styling
  - Mobile-responsive design
  - RTL-friendly layout

## User Flow

1. App starts with `Loading.tsx` component
2. Loading animation plays for 2.5 seconds
3. Automatically transitions to `Dashboard.tsx`
4. Dashboard is fully interactive with working navigation

## Technical Features

- **React 18+** with TypeScript
- **Framer Motion** for smooth animations
- **TailwindCSS** for responsive styling
- **Recharts** for data visualization
- **Lucide React** for icons
- **Strict TypeScript** typing throughout
- **Production-ready** code with proper error handling
- **Accessible** with proper ARIA labels and focus states

## Usage

The main app flow is configured in `App.tsx` where:
- Root path (`/`) shows Loading → Dashboard transition
- Direct dashboard access available at `/dashboard`
- Legacy routes preserved under `/app/*`

## Styling

- Uses Vazirmatn font for Persian text support
- Custom Persian color palette in TailwindCSS
- Responsive breakpoints for desktop and mobile
- Smooth animations and hover states
- Modern gradient effects and shadows

## Performance

- Lightweight animations with GPU acceleration
- Optimized bundle size
- Lazy loading capabilities
- Efficient re-renders with React best practices