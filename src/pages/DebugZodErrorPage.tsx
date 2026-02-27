import React, { useEffect } from 'react';
import { z } from 'zod';

const BuggySchema = z.object({
  id: z.number(),
  name: z.string().min(5),
  metadata: z.object({
    role: z.enum(['admin', 'user']),
    score: z.number().int().min(0).max(100)
  })
});

const SimulateZodErrorPage: React.FC = () => {
  useEffect(() => {
    // 故意に不正なデータをパースして、ZodError を発生させる
    const invalidData = {
      id: "not-a-number",
      name: "abc",
      metadata: {
        role: "guest",
        score: 150
      }
    };

    console.log("Simulating Zod Error...");
    BuggySchema.parse(invalidData);
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Zod Error Simulation</h1>
      <p>このページが読み込まれると、Zodのエラーが自動的にスローされます。</p>
    </div>
  );
};

export default SimulateZodErrorPage;
