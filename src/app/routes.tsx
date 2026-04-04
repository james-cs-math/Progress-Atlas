import { createBrowserRouter } from "react-router";
import { RootWrapper } from "./components/RootWrapper";
import { RootLayout } from "./components/RootLayout";
import { AuthPage } from "./components/AuthPage";
import { CourseSelection } from "./components/CourseSelection";
import { ChatWorkspaceIntegrated } from "./components/ChatWorkspaceIntegrated";
import { DashboardSimplified } from "./components/DashboardSimplified";
import { HowToUse } from "./components/HowToUse";
import { SubscriptionPage } from "./components/SubscriptionPage";
import { ProtectedRoute } from "./components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootWrapper />,
    children: [
      {
        index: true,
        element: <AuthPage />,
      },
      {
        path: "app",
        element: <ProtectedRoute><RootLayout /></ProtectedRoute>,
        children: [
          {
            index: true,
            element: <ChatWorkspaceIntegrated />,
          },
          {
            path: "course-selection",
            element: <CourseSelection />,
          },
          {
            path: "chat",
            element: <ChatWorkspaceIntegrated />,
          },
          {
            path: "dashboard",
            element: <DashboardSimplified />,
          },
          {
            path: "how-to-use",
            element: <HowToUse />,
          },
          {
            path: "subscription",
            element: <SubscriptionPage />,
          },
        ],
      },
    ],
  },
]);