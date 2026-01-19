import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Receipt, PiggyBank } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const monthlyData = [
  { month: 'Jan', revenue: 12000, expenses: 8000 },
  { month: 'Feb', revenue: 15000, expenses: 9000 },
  { month: 'Mar', revenue: 18000, expenses: 10000 },
  { month: 'Apr', revenue: 22000, expenses: 11000 },
  { month: 'May', revenue: 25000, expenses: 12000 },
  { month: 'Jun', revenue: 28000, expenses: 13000 },
];

const revenueByType = [
  { name: 'Web Development', value: 45000, color: 'hsl(217, 91%, 60%)' },
  { name: 'Mobile Apps', value: 30000, color: 'hsl(271, 81%, 56%)' },
  { name: 'SEO Services', value: 15000, color: 'hsl(142, 71%, 45%)' },
  { name: 'UI/UX Design', value: 10000, color: 'hsl(38, 92%, 50%)' },
];

export default function Finances() {
  const totalRevenue = monthlyData.reduce((sum, d) => sum + d.revenue, 0);
  const totalExpenses = monthlyData.reduce((sum, d) => sum + d.expenses, 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = Math.round((netProfit / totalRevenue) * 100);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Financial Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track revenue, expenses, and profitability.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-success flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" /> +12% from last period
              </p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <Receipt className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalExpenses.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <TrendingDown className="h-3 w-3" /> -5% from last period
              </p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              <PiggyBank className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">${netProfit.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{profitMargin}% profit margin</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Revenue vs Expenses</CardTitle>
              <CardDescription>Last 6 months comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="revenue" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Revenue by Service Type</CardTitle>
              <CardDescription>Distribution of income sources</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueByType}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {revenueByType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => `$${value.toLocaleString()}`}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}