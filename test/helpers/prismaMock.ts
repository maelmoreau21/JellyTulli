import { vi } from 'vitest';

// Simple reusable Vitest mock for '@/lib/prisma'.
// Usage (in a test file):
// import { prisma, mockServerFindMany, resetPrismaMock } from 'test/helpers/prismaMock';
// vi.mock('@/lib/prisma', () => ({ default: prisma }));
// mockServerFindMany([{ id: '1', jellyfinServerId: 'srv-1', name: 'Local', url: 'http://localhost', jellyfinApiKey: null, allowAuthFallback: true }]);

const prisma = {
  server: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  // Add other models as needed for tests
};

function mockServerFindMany(rows: unknown[]) {
  prisma.server.findMany.mockResolvedValue(rows);
}

function resetPrismaMock() {
  Object.values(prisma).forEach((model: any) => {
    if (model && typeof model === 'object') {
      Object.values(model).forEach((fn: any) => {
        if (fn && typeof fn.mockReset === 'function') fn.mockReset();
      });
    }
  });
}

export { prisma, mockServerFindMany, resetPrismaMock };
