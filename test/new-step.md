now we want to send the suggested reply when we assign lead
in the list of suggested reply check for name include in the suggested reply then send it

selector path : #suggested_replies
#suggested_replies > div
#suggested_replies > div > div:nth-child(5)

this is the eg of suggested reply:

```html
<div
  title="Hello, thank you for your inquiry.

My name is Yogesh Bhutla , We offer good quality products at competitive prices. I would be happy to share more details based on your requirement.

Please feel free to contact me directly.
Phone: 918065063946

Looking forward to your response. Thank you!"
  class="reply-template mr10 pd8 fs12 cp txt_cntr fwb bgw fl mt2 clr10283f templts_divs por wrd_elip"
>
  <svg
    width="12"
    height="12"
    class="templateIcon"
    viewBox="0 0 18 18"
    fill="none"
    xmlns="https://www.w3.org/2000/svg"
    style="margin-right: -10px;"
  >
    <path
      d="M12.728 6.68602L11.314 5.27202L2 14.586V16H3.414L12.728 6.68602ZM14.142 5.27202L15.556 3.85802L14.142 2.44402L12.728 3.85802L14.142 5.27202ZM4.242 18H0V13.757L13.435 0.322022C13.6225 0.134551 13.8768 0.0292358 14.142 0.0292358C14.4072 0.0292358 14.6615 0.134551 14.849 0.322022L17.678 3.15102C17.8655 3.33855 17.9708 3.59286 17.9708 3.85802C17.9708 4.12319 17.8655 4.37749 17.678 4.56502L4.243 18H4.242Z"
      fill="#2AA699"
    ></path></svg
  ><span>Yogesh</span>
</div>
```

input message box container

```html
<div
  class="df message_section"
  style="align-items: center; padding: 0px 10px; float: right; width: calc(100% - 60px);"
>
  <div
    id="editable_div"
    class="fr w100 mh50 bxrd30 bdr_grey por mt10 topminus10"
    style="height: auto;"
  >
    <div class="rply_contarea" role="presentation" tabindex="0">
      <input
        multiple=""
        type="file"
        tabindex="-1"
        style="border: 0px; clip: rect(0px, 0px, 0px, 0px); clip-path: inset(50%); height: 1px; margin: 0px -1px -1px 0px; overflow: hidden; padding: 0px; position: absolute; width: 1px; white-space: nowrap;"
      />
      <div class="drop-container ">
        <div class="drop-icon">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 18"
            fill="none"
            xmlns="https://www.w3.org/2000/svg"
            stroke="#ffffff"
          >
            <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
            <g
              id="SVGRepo_tracerCarrier"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></g>
            <g id="SVGRepo_iconCarrier">
              <path
                d="M12.5535 2.49392C12.4114 2.33852 12.2106 2.25 12 2.25C11.7894 2.25 11.5886 2.33852 11.4465 2.49392L7.44648 6.86892C7.16698 7.17462 7.18822 7.64902 7.49392 7.92852C7.79963 8.20802 8.27402 8.18678 8.55352 7.88108L11.25 4.9318V16C11.25 16.4142 11.5858 16.75 12 16.75C12.4142 16.75 12.75 16.4142 12.75 16V4.9318L15.4465 7.88108C15.726 8.18678 16.2004 8.20802 16.5061 7.92852C16.8118 7.64902 16.833 7.17462 16.5535 6.86892L12.5535 2.49392Z"
                fill="#ffffff"
              ></path>
              <path
                d="M3.75 15C3.75 14.5858 3.41422 14.25 3 14.25C2.58579 14.25 2.25 14.5858 2.25 15V15.0549C2.24998 16.4225 2.24996 17.5248 2.36652 18.3918C2.48754 19.2919 2.74643 20.0497 3.34835 20.6516C3.95027 21.2536 4.70814 21.5125 5.60825 21.6335C6.47522 21.75 7.57754 21.75 8.94513 21.75H15.0549C16.4225 21.75 17.5248 21.75 18.3918 21.6335C19.2919 21.5125 20.0497 21.2536 20.6517 20.6516C21.2536 20.0497 21.5125 19.2919 21.6335 18.3918C21.75 17.5248 21.75 16.4225 21.75 15.0549V15C21.75 14.5858 21.4142 14.25 21 14.25C20.5858 14.25 20.25 14.5858 20.25 15C20.25 16.4354 20.2484 17.4365 20.1469 18.1919C20.0482 18.9257 19.8678 19.3142 19.591 19.591C19.3142 19.8678 18.9257 20.0482 18.1919 20.1469C17.4365 20.2484 16.4354 20.25 15 20.25H9C7.56459 20.25 6.56347 20.2484 5.80812 20.1469C5.07435 20.0482 4.68577 19.8678 4.40901 19.591C4.13225 19.3142 3.9518 18.9257 3.85315 18.1919C3.75159 17.4365 3.75 16.4354 3.75 15Z"
                fill="#ffffff"
              ></path>
            </g>
          </svg>
        </div>
        <div class="drop-message">Drop your files here</div>
      </div>
      <div class="contdiv tr mlminus5" style="padding-top: 7px;">
        <div class="td w100">
          <div
            class="edt_div2_dsp w100 innerBox "
            title="Type a message here or Type “/” for quick replies"
          >
            <div
              id="massage-text"
              class="lh150 pdb10 mxhgt125 edt_div2 edit_div_new overfw_yauto prewrap m24013090 fs15 "
              contenteditable="true"
              data-placeholder="Type a message here or Type “/” for quick replies"
            >
              Hello, thank you for your inquiry.<br /><br />My name is Yogesh
              Bhutla , We offer good quality products at competitive prices. I
              would be happy to share more details based on your requirement.<br /><br />Please
              feel free to contact me directly.<br />Phone: &lt;span
              style="color: rgb(245, 130, 32); font-family: Poppins, sans-serif;
              font-size: 12px; text-align: center; white-space:
              normal;"&gt;918065063946&lt;/span&gt;<br /><br />Looking forward
              to your response. Thank you!
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="df">
      <div>
        <div class="cp poa btmminu2 lft10 bxrd20 wh42" id="expansion">
          <span
            ><svg
              width="30"
              height="30"
              class=""
              style="color: rgb(104, 104, 104);"
            >
              <use href="#EXPANDED_REPLY_BOX_ICON_NEW2"></use></svg
          ></span>
        </div>
      </div>
    </div>
    <div class="df poa b7 rgt10 flxalgn gap6">
      <div class=""></div>
      <div class="cta-active-override">
        <div class="cp por top5" id="Quotation">
          <span
            style="display: inline-flex; align-items: center; justify-content: center; width: 37px; height: 37px; border-radius: 50%; background-color: transparent;"
            ><img
              src="https://seller.imimg.com/gifs-new/quotation_icon.png"
              width="15"
              height="20"
          /></span>
        </div>
      </div>
      <div class="">
        <div>
          <div class="cp por top5" id="attachment">
            <span
              ><svg
                width="37"
                height="37"
                class=""
                style="color: rgb(42, 166, 153);"
              >
                <use href="#SHARE_ICON_NEW"></use></svg
            ></span>
          </div>
        </div>
      </div>
      <div class="">
        <div>
          <div class="mic-float-btn_new" id="audioRecorder">
            <span
              ><svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="9" y="4" width="6" height="11" rx="3"></rect>
                <path d="M5 11a7 7 0 0 0 14 0"></path>
                <line x1="12" y1="18" x2="12" y2="22"></line></svg
            ></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```
