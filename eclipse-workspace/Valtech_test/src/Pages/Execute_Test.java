package Pages;
import java.util.concurrent.TimeUnit;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.PageFactory;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;

public class Execute_Test 
{
//	WebDriver driver;
//	WebDriverWait wait=new WebDriverWait(driver,20);
//	 
	@Test
	public void Home_blog() 
	{
		
		System.setProperty("webdriver.chrome.driver",System.getProperty("user.dir")+"\\Drivers\\chromedriver.exe");
		WebDriver driver = new ChromeDriver();
		driver.manage().window().maximize();
		driver.manage().timeouts().implicitlyWait(10, TimeUnit.SECONDS);
		
		Home_Page pg =PageFactory.initElements(driver,Home_Page.class);
				 pg.Launch_site();
				 pg.Accept_Cookies.click();
				 try {
					Thread.sleep(40000);// USE EXPLICIT WAIT, CAUSING ISSUE WHEN CALLING CLASS.WEBLEMENT , SHOULD BE CLASS.METHOD.webelement 
				} catch (InterruptedException e) {
					
					e.printStackTrace();
				}
				 WebElement blog_link=pg.first_blog;
				 blog_link.click();		
				 String Blog_First_title=driver.getTitle();
				 String blog_title ="Valtech & Forrester";
				 Assert.assertEquals(Blog_First_title, blog_title);
				 
	}
	
	@Test
	public void menu_Navigation()
	{
		
	}

}
