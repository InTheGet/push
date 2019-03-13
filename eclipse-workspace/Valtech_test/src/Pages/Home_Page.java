package Pages;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.How;
import org.openqa.selenium.support.PageFactory;


public class Home_Page 
{
	
	WebDriver driver;
	
	@FindBy(css="#CybotCookiebotDialogBodyButtonAccept")
	public WebElement Accept_Cookies;
	
	@FindBy(xpath=".//*[@id='valtech-wrapper']/div/main/div[3]/div[1]/div[2]/div[1]/div/div[1]/div[4]/div[1]/a")
	public WebElement first_blog;
	
	public Home_Page(WebDriver driver) 
	{
		this.driver=driver;
		
	
	}
	
	public void Launch_site()
	{
		
	driver.get("https://www.valtech.com/");
		
	}
}
