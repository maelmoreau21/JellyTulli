import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, isAuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

function clampNumber(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export async function GET(req: NextRequest) {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;

    const auditModel = (prisma as any).adminAuditLog;

    const searchParams = req.nextUrl.searchParams;

    const page = clampNumber(Number(searchParams.get("page") || "1") || 1, 1, 10_000);
    const pageSize = clampNumber(Number(searchParams.get("pageSize") || "25") || 25, 1, 100);
    const action = searchParams.get("action")?.trim() || null;
    const actor = searchParams.get("actor")?.trim() || null;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = {};

    if (action) {
        where.action = action;
    }

    if (actor) {
        where.actorUsername = { contains: actor, mode: "insensitive" };
    }

    if (from || to) {
        const createdAt: Record<string, Date> = {};
        if (from) {
            const parsedFrom = new Date(from);
            if (!Number.isNaN(parsedFrom.getTime())) {
                createdAt.gte = parsedFrom;
            }
        }
        if (to) {
            const parsedTo = new Date(to);
            if (!Number.isNaN(parsedTo.getTime())) {
                createdAt.lte = parsedTo;
            }
        }
        if (Object.keys(createdAt).length > 0) {
            where.createdAt = createdAt;
        }
    }

    const [total, rows] = await Promise.all([
        auditModel.count({ where }),
        auditModel.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
            select: {
                id: true,
                action: true,
                actorUserId: true,
                actorUsername: true,
                target: true,
                ipAddress: true,
                details: true,
                createdAt: true,
            },
        }),
    ]);

    return NextResponse.json({
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        rows,
    });
}
