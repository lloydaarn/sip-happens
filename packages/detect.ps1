param([int]$ExcludedPid)
Add-Type @"
using System;using System.Text;using System.Collections.Generic;using System.Runtime.InteropServices;
public class Windows {
 public delegate bool Callback(IntPtr h,IntPtr p);
 [StructLayout(LayoutKind.Sequential)]public struct Rect{public int Left,Top,Right,Bottom;}
 [DllImport("user32.dll")]static extern bool EnumWindows(Callback c,IntPtr p);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll")]static extern int GetWindowLong(IntPtr h,int n);
 [DllImport("user32.dll")]static extern IntPtr GetShellWindow();
 [DllImport("user32.dll",CharSet=CharSet.Auto)]static extern int GetClassName(IntPtr h,StringBuilder name,int count);
 [DllImport("dwmapi.dll")]static extern int DwmGetWindowAttribute(IntPtr h,int attribute,out int value,int size);
 [DllImport("user32.dll")]static extern IntPtr SetThreadDpiAwarenessContext(IntPtr c);
 public static List<int[]> Scan(int excluded){SetThreadDpiAwarenessContext(new IntPtr(-4));var result=new List<int[]>();EnumWindows((h,p)=>{uint pid;GetWindowThreadProcessId(h,out pid);Rect r;var name=new StringBuilder(256);GetClassName(h,name,256);int cloaked;DwmGetWindowAttribute(h,14,out cloaked,4);if(cloaked==0&&name.ToString()!="WorkerW"&&name.ToString()!="Progman"&&name.ToString()!="Shell_TrayWnd"&&name.ToString()!="Shell_SecondaryTrayWnd"&&pid!=excluded&&h!=GetShellWindow()&&IsWindowVisible(h)&&(GetWindowLong(h,-16)&0x00C00000)==0&&GetWindowRect(h,out r)&&r.Right>r.Left&&r.Bottom>r.Top)result.Add(new[]{r.Left,r.Top,r.Right-r.Left,r.Bottom-r.Top});return true;},IntPtr.Zero);return result;}
}
"@
$rectangles=@([Windows]::Scan($ExcludedPid) | ForEach-Object { @{x=$_[0];y=$_[1];width=$_[2];height=$_[3]} })
ConvertTo-Json -InputObject $rectangles -Compress
