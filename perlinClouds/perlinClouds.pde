PVector center;
float diagonal;
 
void setup()
{
  int width = 960, height = 440;
  size(width,height);
  
  center = new PVector(width/2,height/2);
  diagonal = dist(0,0,center.x,center.y);
  
  noiseDetail(5,.5);
  colorMode(HSB, 1);

  for (int i = 1; i < 100; i++){
    makeNew(i);
  }

}

void makeNew(int index){
    
  float hueSeed = random(0.4,1), saturationSeed = random(0.4,1), brightnessSeed = random(0.2);
  
  color darkBlue = color(hueSeed,saturationSeed,brightnessSeed); 
  color lightBlue = color(hueSeed-random(0.4),saturationSeed-random(0.4),brightnessSeed + random(0.3));
  
  setGradient(0, 0, (float)width, (float)height, darkBlue, lightBlue);

  noStroke();
 
  clouds(1,random(1,3),random(.5,1.5),random(.005,.02),random(.8));
  clouds(1,random(1,3),random(1,5),random(.005,.02),random(.8));
  clouds(1,random(3,5),random(3,4),random(.005,.02),random(.8));
  
  save("backgrounds/" + index + ".jpg");
}

void clouds(float xCoeff, float yCoeff, float lightnessMultiplier, float kNoiseDetail, float maxOpacity){
  for (int y = 0; y < height; ++y)
  {
    for (int x = 0; x < width; ++x)
    {
      float v = noise(x*kNoiseDetail*1.2,y*kNoiseDetail*1.2,millis()*.0001);
      
      float hue, saturation, lightness, alpha, distance;
      distance = dist(xCoeff*x,yCoeff*y,xCoeff*center.x,yCoeff*center.y);  // note that distance is calculated ellipsoidally
      hue = 1;  // seek range of 0.7-->0.4 (wrapping)
      saturation = 0.75 - v;
      lightness = v*lightnessMultiplier;  // brighter towards middle
      alpha = maxOpacity - distance*0.6/diagonal;
//      alpha = maxOpacity  * (1- 0.9*distance/diagonal);
      
      
      fill(hue,saturation,lightness,alpha);
      rect(x,y,1,1);   
    }
  }
}

void setGradient(int x, int y, float w, float h, color c1, color c2) {
  noFill();

    for (int i = y; i <= y+h; i++) {
      float inter = map(i, y, y+h, 0, 1);
      color c = lerpColor(c1, c2, inter);
      stroke(c);
      line(x, i, x+w, i);
    }
}
