import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import ClientLayout from "./ClientLayout";

export const dynamic = "force-dynamic";

export default async function SettingsServerLayout({ children }: { children: React.ReactNode }) {
    const sessionAuth = await getServerSession(authOptions);
    if (!sessionAuth?.user?.isAdmin) {
        redirect("/login");
    }

    return <ClientLayout>{children}</ClientLayout>;
}
