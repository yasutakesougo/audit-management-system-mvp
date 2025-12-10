// Azure Functions - 稼働日数計算API
// Power Automate から呼び出す専用のHTTP関数

// Note: Install @azure/functions package in your Azure Functions project
// npm install @azure/functions
// This is a documentation/template file showing the expected interface
interface AzureFunction {
  (context: Context, req: HttpRequest): Promise<void>;
}

interface Context {
  log: {
    (message: string): void;
    error: (message: string, error?: unknown) => void;
  };
  res?: {
    status: number;
    headers?: Record<string, string>;
    body: unknown;
  };
}

interface HttpRequest {
  method: string;
  body: unknown;
}

// 日本の祝日 (2025年)
const holidays2025: Record<string, string[]> = {
  '2025-01': ['2025-01-01', '2025-01-13'],
  '2025-02': ['2025-02-11', '2025-02-23'],
  '2025-03': ['2025-03-20'],
  '2025-04': ['2025-04-29'],
  '2025-05': ['2025-05-03', '2025-05-04', '2025-05-05'],
  '2025-07': ['2025-07-21'],
  '2025-08': ['2025-08-11'],
  '2025-09': ['2025-09-15', '2025-09-23'],
  '2025-10': ['2025-10-13'],
  '2025-11': ['2025-11-03', '2025-11-23'],
  '2025-12': ['2025-12-23']
};

interface WorkingDaysRequest {
  yearMonth: string; // "2025-11"
  excludeWeekends?: boolean; // default: true
  excludeHolidays?: boolean; // default: true
}

interface WorkingDaysResponse {
  yearMonth: string;
  totalDays: number;
  workingDays: number;
  weekends: number;
  holidays: number;
  holidayDates: string[];
}

/**
 * 指定月の稼働日数を計算
 */
function calculateWorkingDays(
  yearMonth: string,
  excludeWeekends: boolean = true,
  excludeHolidays: boolean = true
): WorkingDaysResponse {
  const [year, month] = yearMonth.split('-').map(Number);

  // 月の最終日を取得
  const endDate = new Date(year, month, 0); // 月の最終日
  const totalDays = endDate.getDate();

  let workingDays = totalDays;
  let weekends = 0;
  let holidays = 0;
  const holidayDates = holidays2025[yearMonth] || [];

  // 1日ずつチェック
  for (let day = 1; day <= totalDays; day++) {
    const currentDate = new Date(year, month - 1, day);
    const dateString = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay(); // 0=日曜, 6=土曜

    // 土日チェック
    if (excludeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      weekends++;
      workingDays--;
      continue;
    }

    // 祝日チェック
    if (excludeHolidays && holidayDates.includes(dateString)) {
      holidays++;
      workingDays--;
      continue;
    }
  }

  return {
    yearMonth,
    totalDays,
    workingDays,
    weekends,
    holidays,
    holidayDates
  };
}

/**
 * Azure Functions エントリーポイント
 */
const httpTrigger: AzureFunction = async (context: Context, req: HttpRequest): Promise<void> => {
  context.log('Working Days Calculator function processed a request.');

  try {
    // リクエスト検証
    if (req.method !== 'POST') {
      context.res = {
        status: 405,
        body: { error: 'Method not allowed. Use POST.' }
      };
      return;
    }

    const requestBody = req.body as WorkingDaysRequest;

    if (!requestBody || !requestBody.yearMonth) {
      context.res = {
        status: 400,
        body: {
          error: 'Missing required parameter: yearMonth',
          example: { yearMonth: '2025-11' }
        }
      };
      return;
    }

    // yearMonth 形式検証
    const yearMonthPattern = /^\d{4}-\d{2}$/;
    if (!yearMonthPattern.test(requestBody.yearMonth)) {
      context.res = {
        status: 400,
        body: {
          error: 'Invalid yearMonth format. Expected: YYYY-MM',
          received: requestBody.yearMonth
        }
      };
      return;
    }

    // 稼働日数計算
    const result = calculateWorkingDays(
      requestBody.yearMonth,
      requestBody.excludeWeekends !== false, // default: true
      requestBody.excludeHolidays !== false  // default: true
    );

    context.res = {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400' // 24時間キャッシュ
      },
      body: result
    };

  } catch (error) {
    context.log.error('Error calculating working days:', error);

    context.res = {
      status: 500,
      body: {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
};

export default httpTrigger;

/*
=== Power Automate から呼び出し例 ===

HTTP アクション設定:
- URI: https://[function-app].azurewebsites.net/api/calculate-working-days
- Method: POST
- Headers:
  Content-Type: application/json
- Body:
  {
    "yearMonth": "@{items('Apply_to_each_-_Process_each_month')}",
    "excludeWeekends": true,
    "excludeHolidays": true
  }

レスポンス例:
{
  "yearMonth": "2025-11",
  "totalDays": 30,
  "workingDays": 22,
  "weekends": 8,
  "holidays": 2,
  "holidayDates": ["2025-11-03", "2025-11-23"]
}

Power Automate での利用:
@{body('HTTP_-_Calculate_Working_Days')?['workingDays']}
*/