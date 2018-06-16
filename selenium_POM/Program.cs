using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace selenium_POM
{
    class Program
    {
        IWebDriver driver = new ChromeDriver();

        static void Main(String[] args)
        {

        }
        //public intialize of the webdriver  to use it in all the methods

        //intialize the browser and navigate to the url
        //verify the page is loaded by getting the title of the page 
        [SetUp]
        public void Intialize()
        {
            driver.Navigate().GoToUrl("http://store.demoqa.com/");


        }
        [Test]
        public void Executetest()
        {

            driver.FindElement(By.XPath(".//*[@id='slides']/div[1]/div[3]/div/a/span")).Click();
         
            //driver.url if need match the title

            String mouse_click_title = driver.Title;
            Console.WriteLine(mouse_click_title);
            String mouse_Title = "Magic Mouse | ONLINE STORE";
                                   
            if (mouse_click_title == mouse_Title)
            {
                //asking to click on add cart
                driver.FindElement(By.XPath(".//*[@id='single_product_page_container']/div[1]/div[2]/form/div[2]/div[1]/span")).Click();
            }
            else
            {
                Console.WriteLine("Add to cart button for the magic mouse is not avaliable");
            }
            
            /*    //verify the page has a carousel by wa_wps_foo5496
                IWebElement carasoul = driver.FindElement(By.XPath(".//*[@id='wa_wps_foo5496']"));
                if (carasoul.Displayed)
                {
                    Console.WriteLine("displayed");
                    //verifying the presence of first bag cZ-ML 08333
                    IWebElement first_column = driver.FindElement(By.XPath(".//*[@id='wa_wps_foo_content5496']"));
                    if (first_column.Displayed)
                    {
                        Console.WriteLine("cZ-ML 08333 visible");
                        driver.FindElement(By.XPath(".//*[@id='wa_wps_add_to_cart5496']/a")).Click();
                    }
                   //click on the add to cart button of the first*/
        }

        /*[TearDown]
        public void Clean()
        {
        Console.Beep();

        }*/

    }
}
