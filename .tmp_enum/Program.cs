using System;
using System.Linq;
using MediaBrowser.Model.Tasks;

class Program
{
    static void Main()
    {
        Console.WriteLine("TaskTriggerInfoType members:");
        foreach (var name in Enum.GetNames(typeof(TaskTriggerInfoType)))
        {
            Console.WriteLine(name);
        }
    }
}
